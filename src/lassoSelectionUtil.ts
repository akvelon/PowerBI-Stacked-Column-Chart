"use strict";

import powerbiApi from "powerbi-visuals-api";
import DataView = powerbiApi.DataView;

import * as d3 from 'd3-selection';

import { CategoryDataPoints, IColVisual, SelectionState, VisualDataPoint } from "./visualInterfaces";
import { DataViewConverter } from "./dataViewConverter";
import { d3Selection as d3Selection, DefaultOpacity, DimmedOpacity } from "./utils";

    /*
        undefined, null - no selection
        'selected' - selected
        'justSelected' - is being selected by the lasso with changing opacity, but not really selected yet. Will be added to the selection on mouseup
        'justRemoved' - is being removed by the lasso with changing opacity, but not really removed yet. Will be removed from the selection on mouseup
    */

    interface Selection {
        action: string;
        active: boolean;
        mousemoved: boolean;
        rect?: d3Selection<HTMLElement>;
        rect_node?: HTMLElement;
        startX?: number;
        startY?: number;
        endX?: number;
        endY?: number;
        x?: number;
        y?: number;
        width?: number;
        height?: number;
        clickEvent?: MouseEvent;
    }

    interface CursorPosition {
        x: number;
        y: number;
    }

    export class LassoSelection {
        private visual: IColVisual;
        private visibleBars: HTMLElement[];
        private readonly selection: Selection = {
            action: 'add',
            active: false,
            mousemoved: false
        };
        private indexOfFirstVisibleDataPoint: number;
        private selectionStates: SelectionState[] = []; // Reflects data points' selection state

        constructor(visual: IColVisual) {
            this.visual = visual;
        }

        init(mainElement: d3Selection<HTMLElement>): void {
            if ( !this.selection.rect ){
                this.selection.rect = mainElement.append('div').classed('selection-rect', true).classed('selection-rect-normal-chart', true);
                this.selection.rect_node = this.selection.rect.node() as HTMLElement;
            }

            d3.select('.bar-chart-svg').on('mousedown.selection', (e) => { this.onMousedown(e); });
            d3.select('html')
                .on('mousemove.selection', (e) => { this.onMousemove(e); })
                .on('mouseup.selection', (e) => { this.onMouseup(e); });
        }

        update(bars: d3Selection<any>): void {
            this.visibleBars = [];
            const barsArray = this.visibleBars;
            bars.each(function () {
                barsArray.push(this);
            });
        }

        disable(): void {
            this.emptySelection();
            d3.select('.bar-chart-svg').on('mousedown.selection', null);
            d3.select('html')
                .on('mousemove.selection', null)
                .on('mouseup.selection', null);
        }

        getSelectionStates(): SelectionState[] {
            return this.selectionStates;
        }

        // Events
        private onMousedown(e: MouseEvent): void {
            this.selection.active = true;
            this.selection.clickEvent = e;
            [this.selection.startX, this.selection.startY] = [e.clientX, e.clientY];

            this.setRectPos(e.clientX, e.clientY);
            this.showRect();
            if (!e.ctrlKey) {
                this.emptySelection();
            }
            this.indexOfFirstVisibleDataPoint = this.visual.scrollBar.getIndexOfFirstVisibleDataPoint();
        }

        private onMousemove(e: MouseEvent): void {
            if (!this.selection.active) {
                return;
            }

            if (!this.selection.mousemoved && e.clientX === this.selection?.clickEvent?.clientX && e.clientY === this.selection.clickEvent.clientY) {
                return;
            }

            if (!this.selection.mousemoved) {
                if (!e.ctrlKey) {
                    this.visual.webBehaviorSelectionHandler.handleClearSelection();
                    this.visual.saveSelection();
                }

                this.selection.mousemoved = true;
            }

            this.calculateRectDimensions({
                x: e.clientX,
                y: e.clientY
            });
            this.setRectPos(this.selection.x, this.selection.y);
            this.setRectSize(this.selection.width, this.selection.height);
            const scrollIndex: number = this.indexOfFirstVisibleDataPoint;
            for (let i: number = 0; i < this.visibleBars.length; i++) {
                const collided: boolean = this.detectCollision( this.visibleBars[i] );
                const state: SelectionState = this.selectionStates[scrollIndex + i];
                if (collided) {
                    // Firstly catch the case when we enable the "remove" mode
                    if (( this.selectionStates.indexOf('justSelected') === -1 || this.selectionStates.indexOf('justRemoved') > -1)
                            && state === 'selected') {

                        this.selection.action = 'remove';
                        this.selectionStates[scrollIndex + i] = 'justRemoved';
                        continue;
                    }

                    if (this.selection.action === 'add'
                        && state !== 'selected'
                        && state !== 'justSelected') {

                        this.selectionStates[scrollIndex + i] = 'justSelected';
                    } else if (this.selection.action === 'remove'
                        && state == 'selected') {

                        this.selectionStates[scrollIndex + i] = 'justRemoved';
                    }

                } else if (this.selection.action === 'add'
                            && state === 'justSelected'
                            && state !== null) {

                    this.selectionStates[scrollIndex + i] = null;
                }
            }

            if (this.isEntireCategorySelection()) {
                this.selectEntireCategories();
            }

            this.updateFillOpacity();
        }

        private onMouseup(e: MouseEvent): void {
            if (!this.selection.active) {
                this.deactivateRect();
                return;
            }

            if (!this.selection.mousemoved) { // Selection by click
                const target: HTMLElement = this.selection.clickEvent.target as HTMLElement;
                const scrollIndex: number = this.indexOfFirstVisibleDataPoint;
                if (d3.select(target).classed(this.visual.barClassName)) {
                    const targetIndex = this.visibleBars.indexOf(target);
                    if (this.selection.clickEvent.ctrlKey) {
                        if ( this.selectionStates[scrollIndex + targetIndex] != null ) {
                            this.selectionStates[scrollIndex + targetIndex] = 'justRemoved';
                        } else {
                            this.selectionStates[scrollIndex + targetIndex] = 'justSelected';
                        }
                    } else {
                        this.selectionStates[scrollIndex + targetIndex] = 'justSelected';
                    }
                    if (this.isEntireCategorySelection()) {
                        this.selectEntireCategories();
                    }
                }
            }

            this.deactivateRect();
            this.applySelectionToTheVisual(e);
        }
        // /Events

        private isEntireCategorySelection(): boolean {
            const dataView: DataView = this.visual.getDataView();
            return (
                DataViewConverter.IsMultipleValues(dataView)
                && !DataViewConverter.IsLegendFilled(dataView)
                && (
                    this.selectionStates.indexOf('justSelected') !== -1
                    || this.selectionStates.indexOf('justRemoved') !== -1
                )
            );
        }

        private selectEntireCategories(): void {
            const dataPointsByCategories: CategoryDataPoints[] = this.visual.getDataPointsByCategories();
            let allDataPointsIndex: number = 0;

            for (let categoryIndex: number = 0; categoryIndex < dataPointsByCategories.length; categoryIndex++) {
                const dataPoints: VisualDataPoint[] = dataPointsByCategories[categoryIndex].dataPoints;
                const firstItemIndex: number = allDataPointsIndex;
                const categorySelectionStates: SelectionState[] = [];

                for (let categoryDataPointsIndex: number = 0; categoryDataPointsIndex < dataPoints.length; categoryDataPointsIndex++) {
                    const selectionState: SelectionState = this.selectionStates[allDataPointsIndex];
                    categorySelectionStates.push(selectionState);
                    allDataPointsIndex++;
                }

                if (categorySelectionStates.indexOf('justRemoved') !== -1) {
                    for (let i: number = 0; i < categorySelectionStates.length; i++) {
                        this.selectionStates[firstItemIndex + i] = 'justRemoved';
                    }
                } else if ( categorySelectionStates.indexOf('selected') !== -1 || categorySelectionStates.indexOf('justSelected') !== -1) {
                    for (let i: number = 0; i < categorySelectionStates.length; i++) {
                        if (this.selectionStates[firstItemIndex + i] !== 'selected') {
                            this.selectionStates[firstItemIndex + i] = 'justSelected';
                        }
                    }
                }
            }
        }

        private applySelectionToTheVisual(e: MouseEvent): void {
            if (this.selectionStates.indexOf('justSelected') > -1 && this.selectionStates.indexOf('justRemoved') !== -1) {
                throw new Error('"justSelected" and "justRemoved" items can\'t appear at the same time!');
            }
            const allDataPoints: VisualDataPoint[] = this.visual.getAllDataPoints();
            const handledDataPoints: VisualDataPoint[] = [];

            const isMultiselect: boolean = e.ctrlKey;

            for (let i: number = 0; i < allDataPoints.length; i++) {
                switch (this.selectionStates[i]) {
                    case 'justSelected' :
                        this.selectionStates[i] = 'selected';
                        handledDataPoints.push(allDataPoints[i]);
                        break;
                    case 'justRemoved' :
                        this.selectionStates[i] = null;
                        handledDataPoints.push(allDataPoints[i]);
                        break;
                }
            }

            const selectedDataPoints: VisualDataPoint[] = this.getSelectedDataPoints();
            if ( handledDataPoints.length > 0 ){
                this.visual.webBehaviorSelectionHandler.handleSelection(handledDataPoints, isMultiselect);
            } else if ( selectedDataPoints.length === 0 ) {
                this.visual.webBehaviorSelectionHandler.handleClearSelection();
            }

            this.visual.saveSelection();
        }

        private getSelectedDataPoints(): VisualDataPoint[]{
            const allDataPoints: VisualDataPoint[] = this.visual.getAllDataPoints();
            const selectedDataPoints: VisualDataPoint[] = [];
            
            for (let i: number = 0; i < allDataPoints.length; i++) {
                if ( this.selectionStates[i] === 'selected' ){
                    selectedDataPoints.push( allDataPoints[i] );
                }
            }

            return selectedDataPoints;
        }

        // DOM
        private updateFillOpacity(): void {
            const scrollIndex: number = this.indexOfFirstVisibleDataPoint;
            if ( this.selectionStates.indexOf('selected') === -1 && this.selectionStates.indexOf('justSelected') === -1 ) {
                for (let i: number = 0; i < this.visibleBars.length; i++) {
                    d3.select(this.visibleBars[i])
                    .style('fill-opacity', DefaultOpacity);
                }
            } else {
                for (let i: number = 0; i < this.visibleBars.length; i++) {
                    const bar: HTMLElement = this.visibleBars[i];
                    const d3_bar: d3Selection<SVGRectElement> = d3.select(bar);
                    if (
                        this.selectionStates[i + scrollIndex] === 'selected'
                        || this.selectionStates[i + scrollIndex] === 'justSelected'
                    ) {
                        d3_bar.style(
                            'fill-opacity', DefaultOpacity
                        );
                    } else {
                        d3_bar.style(
                            'fill-opacity', DimmedOpacity
                        );
                    }
                }
            }
        }

        // Arrays manipulate
        private emptySelection(): void {
            this.selectionStates = [];
        }

        // Rect
        private showRect(): void {
            this.selection.rect.classed('selection-rect-active', true);
        }

        private hideRect(): void {
            this.selection.rect.classed('selection-rect-active', false);
        }

        private setRectPos(x: number, y: number): void {
            this.selection.rect.style(
                "left", x.toString() + 'px',
            );
            this.selection.rect.style(
                "top", y.toString() + 'px'
            );
        }

        private setRectSize(width: number, height: number): void {
            this.selection.rect.style(
                "width", width.toString() + 'px',
            );
            this.selection.rect.style(
                "height", height.toString() + 'px'
            );
        }

        private calculateRectDimensions(cursor: CursorPosition): void {
            const selection: Selection = this.selection;

            if (selection.startX <= cursor.x) {
                selection.x = selection.startX;
                selection.width = cursor.x - selection.startX;
                selection.endX = selection.x + selection.width;
            } else {
                selection.x = cursor.x;
                selection.width = selection.startX - selection.x;
                selection.endX = selection.x;
            }

            if (selection.startY <= cursor.y) {
                selection.y = selection.startY;
                selection.height = cursor.y - selection.startY;
                selection.endY = selection.y + selection.height;
            } else {
                selection.y = cursor.y;
                selection.height = selection.startY - selection.y;
                selection.endY = selection.y;
            }
        }

        private deactivateRect(): void {
            this.selection.mousemoved = false;
            this.selection.active = false;
            this.selection.action = 'add';
            this.hideRect();
            const backgroundStyle: string = this.selection.rect_node.style.backgroundColor;
            this.selection.rect_node.setAttribute('style', '');
            this.selection.rect_node.style.backgroundColor = backgroundStyle;
        }
        // / Rect


        // Utils
        private detectCollision(bar: HTMLElement): boolean {
            const bounds: ClientRect = bar.getBoundingClientRect();

            if (bounds.width === 0) {
                return false;
            }

            if (this.selection.x <= bounds.right
                && this.selection.x + this.selection.width >= bounds.left
                && this.selection.y <= bounds.bottom
                && this.selection.y + this.selection.height >= bounds.top) {

                return true;
            } else {
                return false;
            }
        }
    }
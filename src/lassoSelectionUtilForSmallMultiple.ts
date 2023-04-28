'use strict';

import {ClassAndSelector} from 'powerbi-visuals-utils-svgutils/lib/cssConstants';

import {d3Selection, DefaultOpacity, DimmedOpacity} from './utils';
import {IColVisual, VisualDataPoint} from './visualInterfaces';

import * as d3 from 'd3-selection';

import powerbiApi from 'powerbi-visuals-api';
import PrimitiveValue = powerbiApi.PrimitiveValue;

interface CursorPosition {
    x: number;
    y: number;
}

enum SelectionAction {
    Add = 1,
    Remove
}

class Constants {
    public static RectClass: string = 'selection-rect';
    public static RectAdditionalClass: string = 'selection-rect-small-multiple';
    public static EventNameSpace: string = '.selectionForSmallMultiple';
}

export class LassoSelectionForSmallMultiple {
    private visual: IColVisual;

    private lasso: Lasso = new Lasso();
    private lassoElement: LassoElement;

    private svgChart: d3Selection<any>;
    private domItems = new DomItems();

    private preselection: Preselection = new Preselection();

    private legendBucketFilled: boolean;

    private barClassName: string;

    constructor(barSelect: ClassAndSelector, visual: IColVisual) {
        this.barClassName = barSelect.className;
        this.visual = visual;
    }

    init(mainElement: d3Selection<HTMLElement>): void {

        const rectangleElement: d3Selection<any> = mainElement.append('div').classed(Constants.RectClass, true).classed(Constants.RectAdditionalClass, true);
        this.lassoElement = new LassoElement(rectangleElement);
    }

    update(svgChart: d3Selection<any>, bars: d3Selection<any>, legendBucketFilled: boolean): void {
        this.svgChart = svgChart;
        this.domItems.update(bars);
        this.legendBucketFilled = legendBucketFilled;

        this.svgChart.on(`mousedown${Constants.EventNameSpace}`, (e) => {
            this.lasso.init(e as MouseEvent);
        });
        d3.select('html')
            .on(`mousemove${Constants.EventNameSpace}`, this.onMousemove.bind(this))
            .on(`mouseup${Constants.EventNameSpace}`, this.onMouseup.bind(this));
    }

    disable(): void {
        if (this.svgChart) {
            this.svgChart.on(`mousedown${Constants.EventNameSpace}`, null);
        }
        d3.select('html')
            .on(`mousemove${Constants.EventNameSpace}`, null)
            .on(`mouseup${Constants.EventNameSpace}`, null);
    }

    private onMousemove(e: MouseEvent): void {
        if (!this.lasso.started) {
            if (this.lasso.detectIfStarted(e)) {
                this.start();
            } else {
                return;
            }
        }

        this.lasso.calculateRectDimensions({
            x: e.clientX,
            y: e.clientY,
        });

        this.lassoElement.setPos(this.lasso.x, this.lasso.y);
        this.lassoElement.setSize(this.lasso.width, this.lasso.height);

        this.preselection.updatePreselectionData(this.lasso, this.domItems.get(), e.ctrlKey);

        if (!this.legendBucketFilled) {
            this.preselection.preSelectEntireCategories(this.svgChart);
        }

        this.domItems.setPreviewStyles();
    }

    private onMouseup(): void {
        if (!this.lasso.active) {
            return;
        }

        if (!this.lasso.started) {
            this.onClick();
            if (!this.legendBucketFilled) {
                this.preselection.preSelectEntireCategories(this.svgChart);
            }
        }

        this.performSelection();

        this.domItems.setStyles();

        this.end();
    }

    private onClick(): void {
        const target: d3Selection<any> = d3.select(this.lasso.mousedown.target as HTMLElement);

        // a click on an empty space
        if (!target.classed(this.barClassName)) {
            if (!this.lasso.mousedown.ctrlKey) {
                this.domItems.clearSelectionData();
            }
            return;
        }

        const datum: VisualDataPoint = target.datum() as VisualDataPoint;

        // multiselection by Ctrl
        if (this.lasso.mousedown.ctrlKey) {
            datum.preRemoved = DomItems.dataPointIsPartOfSelection(datum);
            datum.preSelected = !datum.preRemoved;
            return;
        }

        // single selection of the non-selected point
        if (!DomItems.dataPointIsPartOfSelection(datum)) {
            this.domItems.clearSelectionData();
            datum.preSelected = true;
            return;
        }

        // single selection of the selected point
        const countPreselected: number = this.domItems.countPreselectedOrSelected();
        this.domItems.clearSelectionData();
        if (countPreselected !== 1) {
            // deselecting the only-selected point
            datum.preSelected = true;
        }
    }

    private start(): void {
        this.lasso.started = true;

        if (!this.lasso.mousedown.ctrlKey) {
            this.domItems.clearSelectionData();
        }

        this.lassoElement.show();
    }

    private end(): void {
        this.lasso.reset();
        this.preselection.reset();
        this.lassoElement.deactivate();
    }

    private performSelection(): void {
        const bars: d3Selection<any> = this.domItems.get();

        const handledDataPoints: VisualDataPoint[] = [];
        const selectedDataPoints: VisualDataPoint[] = [];

        bars.each((d: VisualDataPoint) => {
            if (d.preSelected) {
                d.selected = true;
                handledDataPoints.push(d);
            } else if (d.preRemoved) {
                d.selected = false;
                handledDataPoints.push(d);
            }

            if (d.selected) {
                selectedDataPoints.push(d);
            }

            d.preSelected = d.preRemoved = false;
        });

        if (handledDataPoints.length > 0) {
            this.visual.webBehaviorSelectionHandler.handleSelection(handledDataPoints, this.lasso.mousedown.ctrlKey);
        } else if (!this.lasso.mousedown.ctrlKey && !this.domItems.hasHighlight()) {
            this.visual.webBehaviorSelectionHandler.handleClearSelection();
        }

        this.visual.saveSelection();
    }
}

class Preselection {
    private action: SelectionAction | null = null;

    reset(): void {
        this.action = null;
    }

    updatePreselectionData(selectionService: Lasso, bars: d3Selection<any>, ctrlKey: boolean): void {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self: Preselection = this;

        if (!ctrlKey) {
            self.action = SelectionAction.Add;
        }

        bars.each(function (d: VisualDataPoint) {
            const collision: boolean = selectionService.detectCollision(this);

            if (self.action === null && collision) {
                self.action = d.selected ? SelectionAction.Remove : SelectionAction.Add;
            }

            switch (self.action) {
                case SelectionAction.Add : {
                    d.preSelected = collision && !d.selected;
                    break;
                }
                case SelectionAction.Remove : {
                    d.preRemoved = collision && d.selected;
                    break;
                }
            }
        });
    }

    preSelectEntireCategories(svgChart: d3Selection<any>): void {
        svgChart.selectAll('.bar-group').each(function () {
            const bars: d3Selection<any> = d3.select(this).selectAll('.bar');

            const preSelectedCategories: PrimitiveValue[] = [];
            const preRemovedCategories: PrimitiveValue[] = [];

            bars.each(function (d: VisualDataPoint) {
                if (d.preSelected) {
                    preSelectedCategories.push(d.category);
                } else if (d.preRemoved) {
                    preRemovedCategories.push(d.category);
                }
            });

            bars.each(function (d: VisualDataPoint) {
                if (preSelectedCategories.indexOf(d.category) > -1) {
                    d.preSelected = true;
                } else if (preRemovedCategories.indexOf(d.category) > -1) {
                    d.preRemoved = true;
                }
            });
        });
    }
}

class DomItems {
    private bars: d3Selection<any>;

    update(bars: d3Selection<any>): void {
        this.bars = bars;
    }

    get(): d3Selection<any> {
        return this.bars;
    }

    setPreviewStyles(): void {
        if (this.countPreselectedOrSelected() > 0) {
            this.setOpacity(
                null,
                (d: VisualDataPoint) => DomItems.dataPointIsPartOfSelection(d) ? DefaultOpacity : DimmedOpacity,
            );
        } else if (!this.hasHighlight()) {
            this.setOpacity(DefaultOpacity);
        }
    }

    countPreselectedOrSelected(): number {
        const preselected: d3Selection<any> = this.bars.filter((d: VisualDataPoint) =>
            DomItems.dataPointIsPartOfSelection(d),
        );

        return preselected.size();
    }

    setStyles(): void {
        if (this.countPreselectedOrSelected() > 0) {
            this.setOpacity(
                null,
                (d: VisualDataPoint) => d.selected ? DefaultOpacity : DimmedOpacity,
            );
            this.setStroke(true);
        } else if (!this.hasHighlight()) {
            this.setOpacity(DefaultOpacity);
            this.setStroke(false);
        }
    }

    clearSelectionData(): void {
        this.bars.each((d: VisualDataPoint) => {
            d.selected = d.preSelected = false;
        });
    }

    hasHighlight(): boolean {
        return this.bars.filter((d: VisualDataPoint) => !!d.highlight).size() > 0;
    }

    static dataPointIsPartOfSelection(d: VisualDataPoint): boolean {
        return !d.preRemoved && (d.preSelected || d.selected);
    }

    private setStroke(hasSelection: boolean) {
        this.bars.each(function (d: VisualDataPoint) {
            this.style.stroke = hasSelection ? '#000000' : (d.color || '');
        });
    }

    private setOpacity(opacity: number, calculateOpacity?: ((d: VisualDataPoint) => number)): void {
        this.bars.each(function (d: VisualDataPoint) {
            const opacityValue: number | undefined = opacity ? opacity : calculateOpacity && calculateOpacity(d);

            if (opacityValue) {
                this.style.fillOpacity = opacityValue.toString();
                this.style.strokeOpacity = opacityValue.toString();
            }
        });
    }
}

class Lasso {
    active: boolean = false;
    started: boolean = false;

    x: number;
    y: number;
    width: number;
    height: number;
    private startX: number;
    private startY: number;
    endX: number;
    endY: number;

    mousedown: MouseEvent;

    init(mousedown: MouseEvent) {
        this.active = true;

        this.mousedown = mousedown;

        this.startX = mousedown.clientX;
        this.startY = mousedown.clientY;
    }

    reset(): void {
        this.started = false;
        this.active = false;
    }

    detectIfStarted(mousemove: MouseEvent): boolean {
        if (!this.active) {
            return false;
        }

        return (
            mousemove.clientX !== this.mousedown.clientX
            || mousemove.clientY !== this.mousedown.clientY
        );
    }

    calculateRectDimensions(cursor: CursorPosition): void {
        if (this.startX <= cursor.x) {
            this.x = this.startX;
            this.width = cursor.x - this.startX;
            this.endX = this.x + this.width;
        } else {
            this.x = cursor.x;
            this.width = this.startX - this.x;
            this.endX = this.x;
        }

        if (this.startY <= cursor.y) {
            this.y = this.startY;
            this.height = cursor.y - this.startY;
            this.endY = this.y + this.height;
        } else {
            this.y = cursor.y;
            this.height = this.startY - this.y;
            this.endY = this.y;
        }
    }

    detectCollision(element: HTMLElement): boolean {
        const bounds: ClientRect = element.getBoundingClientRect();

        if (bounds.width === 0) {
            return false;
        }

        if (this.x <= bounds.right
            && this.x + this.width >= bounds.left
            && this.y <= bounds.bottom
            && this.y + this.height >= bounds.top) {

            return true;
        } else {
            return false;
        }
    }
}

class LassoElement {
    private d3_element: d3Selection<any>;
    private element: HTMLElement;

    constructor(d3_element: d3Selection<any>) {
        this.d3_element = d3_element;
        this.element = d3_element.node() as HTMLElement;
    }

    show(): void {
        this.d3_element.classed('selection-rect-active', true);
    }

    hide(): void {
        this.d3_element.classed('selection-rect-active', false);
    }

    deactivate(): void {
        this.hide();
        this.resetStyleAttribute();
    }

    setPos(x: number, y: number): void {
        this.d3_element.style(
            'left', x.toString() + 'px',
        );
        this.d3_element.style(
            'top', y.toString() + 'px',
        );
    }

    setSize(width: number, height: number): void {
        this.d3_element.style(
            'width', width.toString() + 'px',
        );
        this.d3_element.style(
            'height', height.toString() + 'px',
        );
    }

    private resetStyleAttribute(): void {
        this.element.setAttribute('style', '');
    }
}

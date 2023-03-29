"use strict";

import { IMargin } from "powerbi-visuals-utils-svgutils";

import { select } from "d3-selection";

import powerbiApi from "powerbi-visuals-api";
import VisualUpdateType = powerbiApi.VisualUpdateType;

import { CategoryDataPoints, IColVisual, VisualDataPoint } from "./visualInterfaces";
import { d3Selection as d3Selection } from "./utils";

export const enum ScrollbarState {
    Disable = "disable",
    Enable = "enable"
}

interface ScrollBarSettings {
    readonly trackSize; // Considered as width for vertical mode and as height for horizontal mode
    readonly trackMargin; // Margin between track and visual
    minCategorySpace: number; // Minimum of space needed for rendering one category
}
interface Scrolling {
    active: boolean;
    mousedownClientY: number;
    mousemoveStartY: number;
    currentY: number;
    positionsCount: number;
    currentPosition: number;
}
interface Track {
    el: d3Selection<HTMLElement>;
    left: number;
    top: number;
    width: number;
    height: number;
    availableScrollDistance: number;
}

export class ScrollBar {
    readonly settings: ScrollBarSettings = {
        trackSize: 10,
        trackMargin: 10,
        minCategorySpace: 25
    };

    // Easiest way to allow/disallow scrollbar functionality
    private readonly allow: boolean = true;
    private enabled: boolean = false;
    private visual: IColVisual;
    private scrolling: Scrolling = {
        active: false,
        mousedownClientY : 0,
        mousemoveStartY: 0,
        currentY: 0,
        positionsCount: 0,
        currentPosition: 0
    };
    private visibleDataPoints: VisualDataPoint[];
    private visibleDataPointsByCategories: CategoryDataPoints[];
    // Maximum of bars that can appear at the same time
    private capacity: number;
    private htmlElement: d3Selection<HTMLElement>;
    private mainElement: d3Selection<HTMLElement>;
    private track: Track = {
        el: null,
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        availableScrollDistance: 1 // Must not be 0 because appears as the denominator
    };
    private handle: d3Selection<HTMLElement>;

    constructor(visual: IColVisual) {
        this.visual = visual;
    }

    init(mainElement: d3Selection<HTMLElement>): void {
        this.htmlElement = select('html');
        this.mainElement = mainElement;
        this.track.el = this.mainElement.append('div').classed('scrollbar-track', true);
        this.handle = this.track.el.append('button').classed('scrollbar-handle', true);

        this.handle.on('mousedown', (e) => { this.onMousedown(e); });
        this.htmlElement
            .on('mousemove', (e) => { this.onMousemove(e); })
            .on('mouseup', () => { this.onMouseup(); });
        this.mainElement.on('wheel', (e) => { this.onMousewheel(e); });
    }

    update(): void {
        if ( !this.enabled ) {
            return;
        }
        this.updateMeasurements();
    }

    updateData(action: ScrollbarState, updateType: VisualUpdateType): void {
        this.settings.minCategorySpace =  this.visual.settings.categoryAxis.minCategoryWidth;

        const availableSpace: number = this.visual.viewport.height - this.visual.visualMargin.top - this.visual.visualMargin.bottom;

        this.capacity = Math.floor(availableSpace / this.settings.minCategorySpace);
        this.scrolling.positionsCount = this.visual.categoriesCount - this.capacity;

        if ( this.allow && action === ScrollbarState.Enable && this.scrolling.positionsCount > 0 ) {
            this.enable();
            if (powerbiApi.VisualUpdateType.Resize === (updateType & powerbiApi.VisualUpdateType.Resize) ||
                powerbiApi.VisualUpdateType.ResizeEnd === (updateType & powerbiApi.VisualUpdateType.ResizeEnd)) {
                this.correctScrollingPosition();
            } else {
                this.updateScrollingPosition(0);
            }
            this.updateHandlerTranslateY(true);
            this.determineDataOfVisibleItems();
        } else {
            this.disable();
        }
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    getScrollPosition(): number {
        return this.scrolling.currentPosition;
    }

    getVisibleDataPoints(): VisualDataPoint[] {
        return this.visibleDataPoints;
    }

    getIndexOfFirstVisibleDataPoint(): number | null {
        const allDataPoints: VisualDataPoint[] = this.visual.getAllDataPoints().filter(x => !x.highlight);
        const firstVisibleDataPoint: VisualDataPoint = this.visibleDataPoints[0];

        for (let i: number = 0; i < allDataPoints.length; i++) {
            if ( allDataPoints[i] === firstVisibleDataPoint ) {
                return i;
            }
        }
        return null;
    }

    private onMousedown(e: MouseEvent): void {
        if ( !this.enabled ) {
            return;
        }
        this.scrolling.mousedownClientY = e.clientY;
        this.scrolling.active = true;
        this.scrolling.mousemoveStartY = this.scrolling.currentY;
    }

    private onMousemove(e: MouseEvent): void {
        if ( !this.scrolling.active ) {
            return;
        }

        this.scrolling.currentY = this.scrolling.mousemoveStartY + (e.clientY - this.scrolling.mousedownClientY);

        this.updateHandlerTranslateY();
        this.updateScrollingPosition();
        this.determineDataOfVisibleItems();
        this.visual.onScrollPosChanged();
    }

    private onMouseup(): void {
        if ( !this.scrolling.active ) {
            return;
        }
        this.scrolling.active = false;
        this.scrolling.mousemoveStartY = 0;
    }

    private onMousewheel(e: WheelEvent): void {
        if ( !this.enabled ) {
            return;
        }
        if ( e.deltaY > 0 ) {
            this.updateScrollingPosition(1, true);
        } else {
            this.updateScrollingPosition(-1, true);
        }

        this.updateHandlerTranslateY(true);
        this.determineDataOfVisibleItems();
        this.visual.onScrollPosChanged();
    }

    private enable(): void {
        this.enabled = true;
        this.track.el.style('display', 'block');
    }

    private disable(): void {
        this.enabled = false;
        this.visibleDataPoints = this.visual.getAllDataPoints();
        this.track.el.style('display', '');
    }

    private determineDataOfVisibleItems(): void {
        this.visibleDataPointsByCategories = [];
        this.visibleDataPoints = [];

        const dataPointsByCategories: CategoryDataPoints[] = this.visual.getDataPointsByCategories();

        for (let categoryIndex: number = 0; categoryIndex < dataPointsByCategories.length; categoryIndex++) {
            if ( categoryIndex < this.scrolling.currentPosition) {
                continue;
            }

            if ( categoryIndex >= this.scrolling.currentPosition + this.capacity ) {
                break;
            }

            this.visibleDataPointsByCategories.push( dataPointsByCategories[categoryIndex] );
            // Add all items of this category
            this.visibleDataPoints.push( ...dataPointsByCategories[categoryIndex].dataPoints );
        }
    }

    private correctScrollingPosition(){
        // Correcting the value if it goes beyond the limits
        if ( this.scrolling.currentPosition < 0 ) {
            this.scrolling.currentPosition = 0;
        } else if ( this.scrolling.currentPosition >= this.scrolling.positionsCount ) {
            this.scrolling.currentPosition = this.scrolling.positionsCount;
        }
    }

    private updateScrollingPosition(newValue?: number, relative?: boolean): void {
        if ( newValue == null ) {
            // Default parameterless case: calculate the value based on handle position
            this.scrolling.currentPosition = Math.round(this.scrolling.currentY / this.track.availableScrollDistance * this.scrolling.positionsCount);
        } else if ( relative ) {
            // Increase or decrease basing on current value
            this.scrolling.currentPosition += newValue;
        } else {
            // Set a defined point
            this.scrolling.currentPosition = newValue;
        }

        this.correctScrollingPosition();
    }

    private updateMeasurements(): void {
        const visualMargin: IMargin = this.visual.visualMargin;
        const track: Track = this.track;

        track.width = this.settings.trackSize;
        track.height = this.visual.visualSize.height;
        track.top = visualMargin.top;
        track.left = this.visual.viewport.width - this.settings.trackSize;

        if (this.visual.isLegendNeeded) {
            const legendPosition = this.visual.settings.legend.position;

            if ( legendPosition === 'Top' || legendPosition === 'TopCenter' ) {
                track.top += this.visual.legendSize.height;
            } else if ( legendPosition === 'Right' || legendPosition === 'RightCenter' ) {
                track.left -= this.visual.legendSize.width;
            }
        }

        track.el.style(
            "top", this.track.top + 'px',
        )
        .style(
            "left", this.track.left + 'px',
        )
        .style(
            "height", this.track.height + 'px',
        )
        .style(
            "width", this.track.width + 'px'
        );

        const visibleCategoriesCount: number = this.visibleDataPointsByCategories.length;
        const allCategoriesCount: number = this.visual.getDataPointsByCategories().length;
        const handleHeight: number = track.height * (visibleCategoriesCount / allCategoriesCount);
        this.handle.style('height', handleHeight + 'px');

        track.availableScrollDistance = track.height - handleHeight;
    }

    private updateHandlerTranslateY(byScrollingPosition?: boolean): void {
        if ( byScrollingPosition ) {
            this.scrolling.currentY = Math.round( this.scrolling.currentPosition / this.scrolling.positionsCount * this.track.availableScrollDistance );
        }

        if ( this.scrolling.currentY < 0 ) {
            this.scrolling.currentY = 0;
        } else if ( this.scrolling.currentY > this.track.availableScrollDistance) {
            this.scrolling.currentY = this.track.availableScrollDistance;
        }

        this.handle.style('transform', `translateY(${this.scrolling.currentY}px)`);
    }
}
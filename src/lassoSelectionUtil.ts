module powerbi.extensibility.visual.visualUtils {

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
        rect?: d3.Selection<HTMLElement>;
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
        private visual: Visual;
        private visibleBars: HTMLElement[];
        private readonly selection: Selection = {
            action: 'add',
            active: false,
            mousemoved: false
        };
        private indexOfFirstVisibleDataPoint: number;
        private selectionStates: SelectionState[] = []; // Reflects data points' selection state

        constructor(visual: Visual) {
            this.visual = visual;
        }

        init(mainElement: d3.Selection<HTMLElement>): void {
            if ( !this.selection.rect ){
                this.selection.rect = mainElement.append('div').classed('selection-rect', true).classed('selection-rect-normal-chart', true);
                this.selection.rect_node = this.selection.rect.node() as HTMLElement;
            }

            d3.select('.bar-chart-svg').on('mousedown.selection', () => { this.onMousedown(); });
            d3.select('html')
                .on('mousemove.selection', () => { this.onMousemove(); })
                .on('mouseup.selection', () => { this.onMouseup(); });
        }

        update<Datum>(bars: d3.Selection<any>): void {
            this.visibleBars = [];
            let barsArray = this.visibleBars;
            bars.each(function (datum: Datum, index: number, outerIndex: number) {
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
        private onMousedown(): void {
            let e: MouseEvent = d3.event as MouseEvent;

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

        private onMousemove(): void {
            if (!this.selection.active) {
                return;
            }

            let e: MouseEvent = d3.event as MouseEvent;
            if (!this.selection.mousemoved && e.clientX === this.selection.clickEvent.clientX && e.clientY === this.selection.clickEvent.clientY) {
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
            let scrollIndex: number = this.indexOfFirstVisibleDataPoint;
            let bars: HTMLElement[] = this.visibleBars;
            for (let i: number = 0; i < bars.length; i++) {
                let collided: boolean = this.detectCollision( this.visibleBars[i] );
                let state: SelectionState = this.selectionStates[scrollIndex + i];
                if (collided) {
                    // Firstly catch the case when we enable the "remove" mode
                    if ((this.selectionStates.indexOf('justSelected') === -1 || this.selectionStates.indexOf('justRemoved') > -1 )
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
                                && state == 'selected'
                                && state != null) {

                        this.selectionStates[scrollIndex + i] = 'justRemoved';
                    }

                } else if (this.selection.action === 'add' && state === 'justSelected') {
                    this.selectionStates[scrollIndex + i] = null;
                }
            }

            if (this.isEntireCategorySelection()) {
                this.selectEntireCategories();
            }

            this.updateFillOpacity();
        }

        private onMouseup(): void {
            if (!this.selection.active) {
                this.deactivateRect();
                return;
            }

            if (!this.selection.mousemoved) { // Selection by click
                let target: HTMLElement = this.selection.clickEvent.target as HTMLElement;
                let scrollIndex: number = this.indexOfFirstVisibleDataPoint;
                if (d3.select(target).classed(this.visual.barClassName)) {
                    let targetIndex = this.visibleBars.indexOf(target);
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
            this.applySelectionToTheVisual();
        }

        private isEntireCategorySelection(): boolean {
            let dataView: DataView = this.visual.getDataView();
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
            let dataPointsByCategories: CategoryDataPoints[] = this.visual.getDataPointsByCategories();
            let allDataPointsIndex: number = 0;

            for (let categoryIndex: number = 0; categoryIndex < dataPointsByCategories.length; categoryIndex++) {
                let dataPoints: VisualDataPoint[] = dataPointsByCategories[categoryIndex].dataPoints;
                let firstItemIndex: number = allDataPointsIndex;
                let categorySelectionStates: SelectionState[] = [];

                for (let categoryDataPointsIndex: number = 0; categoryDataPointsIndex < dataPoints.length; categoryDataPointsIndex++) {
                    let selectionState: SelectionState = this.selectionStates[allDataPointsIndex];
                    categorySelectionStates.push(selectionState);
                    allDataPointsIndex++;
                }

                if (categorySelectionStates.indexOf('justRemoved') !== -1) {
                    for (let i: number = 0; i < categorySelectionStates.length; i++) {
                        this.selectionStates[firstItemIndex + i] = 'justRemoved';
                    }
                } else if (categorySelectionStates.indexOf('selected') !== -1 || categorySelectionStates.indexOf('justSelected') !== -1) {
                    for (let i: number = 0; i < categorySelectionStates.length; i++) {
                        if (this.selectionStates[firstItemIndex + i] !== 'selected') {
                            this.selectionStates[firstItemIndex + i] = 'justSelected';
                        }
                    }
                }
            }
        }

        // /Events

        private applySelectionToTheVisual(): void {
            if (this.selectionStates.indexOf('justSelected') > -1 && this.selectionStates.indexOf('justRemoved') !== -1) {
                throw new Error('"justSelected" and "justRemoved" items can\'t appear at the same time!');
            }
            let allDataPoints: VisualDataPoint[] = this.visual.getAllDataPoints();
            let handledDataPoints: VisualDataPoint[] = [];

            let isMultiselect: boolean = (d3.event as MouseEvent).ctrlKey;

            for (let i: number = 0; i < allDataPoints.length; i++) {
                switch ( this.selectionStates[i] ) {
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
            let scrollIndex: number = this.indexOfFirstVisibleDataPoint;
            if ( this.selectionStates.indexOf('selected') === -1 && this.selectionStates.indexOf('justSelected') === -1 ) {
                for (let i: number = 0; i < this.visibleBars.length; i++) {
                    d3.select(this.visibleBars[i]).style({
                        'fill-opacity': DefaultOpacity,
                    });
                }
            } else {
                for (let i: number = 0; i < this.visibleBars.length; i++) {
                    let bar: HTMLElement = this.visibleBars[i];
                    let d3_bar: d3.Selection<SVGRectElement> = d3.select(bar);
                    if (
                        this.selectionStates[i + scrollIndex] === 'selected'
                        || this.selectionStates[i + scrollIndex] === 'justSelected'
                    ) {
                        d3_bar.style({
                            'fill-opacity': DefaultOpacity
                        });
                    } else {
                        d3_bar.style({
                            'fill-opacity': DimmedOpacity
                        });
                    }
                }
            }
        }
        // /DOM


        // Arrays manipulate
        private emptySelection(): void {
            this.selectionStates = [];
        }
        // / Arrays manipulate

        // Rect
        private showRect(): void {
            this.selection.rect.classed('selection-rect-active', true);
        }

        private hideRect(): void {
            this.selection.rect.classed('selection-rect-active', false);
        }

        private setRectPos(x: number, y: number): void {
            this.selection.rect.style({
                left: x.toString() + 'px',
                top: y.toString() + 'px'
            });
        }

        private setRectSize(width: number, height: number): void {
            this.selection.rect.style({
                width: width.toString() + 'px',
                height: height.toString() + 'px'
            });
        }

        private calculateRectDimensions(cursor: CursorPosition): void {
            let selection: Selection = this.selection;

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
            let backgroundStyle: string = this.selection.rect_node.style.backgroundColor;
            this.selection.rect_node.setAttribute('style', '');
            this.selection.rect_node.style.backgroundColor = backgroundStyle;
        }
        // / Rect


        // Utils
        private detectCollision(bar: HTMLElement): boolean {
            let bounds: ClientRect = bar.getBoundingClientRect();

            if (bounds.height === 0) {
                return false;
            }

            if (
                this.selection.x <= bounds.right
                && this.selection.x + this.selection.width >= bounds.left
                && this.selection.y <= bounds.bottom
                && this.selection.y + this.selection.height >= bounds.top
            ) {
                return true;
            } else {
                return false;
            }
        }
        // / Utils

    }
}
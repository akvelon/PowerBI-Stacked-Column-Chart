/*
 *  Power BI Visual CLI
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

module powerbi.extensibility.visual {
    "use strict";
    import svg = powerbi.extensibility.utils.svg;
    import CssConstants = svg.CssConstants;
    import IInteractiveBehavior = powerbi.extensibility.utils.interactivity.IInteractiveBehavior;
    import IInteractivityService = powerbi.extensibility.utils.interactivity.IInteractivityService;
    import createInteractivityService = powerbi.extensibility.utils.interactivity.createInteractivityService;
    import appendClearCatcher = powerbi.extensibility.utils.interactivity.appendClearCatcher;
    import ITooltipServiceWrapper = powerbi.extensibility.utils.tooltip.ITooltipServiceWrapper;
    import createTooltipServiceWrapper = powerbi.extensibility.utils.tooltip.createTooltipServiceWrapper;
    import ISelectionHandler = powerbi.extensibility.utils.interactivity.ISelectionHandler;
    import axis = powerbi.extensibility.utils.chart.axis;
    import valueType = powerbi.extensibility.utils.type.ValueType;
    import ScrollbarState = visualUtils.ScrollbarState;
    import IValueFormatter = powerbi.extensibility.utils.formatting.IValueFormatter;
    import PixelConverter = powerbi.extensibility.utils.type.PixelConverter;

    // powerbi.extensibility.utils.type
    import ILegend = powerbi.extensibility.utils.chart.legend.ILegend;
    import createLegend = powerbi.extensibility.utils.chart.legend.createLegend;

    module Selectors {
        export const MainSvg = CssConstants.createClassAndSelector("bar-chart-svg");
        export const VisualSvg = CssConstants.createClassAndSelector("bar-chart-visual");
        export const BarSelect = CssConstants.createClassAndSelector("bar");
        export const BarGroupSelect = CssConstants.createClassAndSelector("bar-group");
        export const AxisGraphicsContext = CssConstants.createClassAndSelector("axisGraphicsContext");
        export const AxisLabelSelector = CssConstants.createClassAndSelector("axisLabel");
        export const LabelGraphicsContext = CssConstants.createClassAndSelector("labelGraphicsContext");
        export const LabelBackgroundContext = CssConstants.createClassAndSelector("labelBackgroundContext");
    }

    export class Visual implements IVisual {
        public static DefaultColor: string = "#777777";

        private allDataPoints: VisualDataPoint[];
        public allUniqueCategories: string[];

        public viewport: IViewport;

        public webBehaviorSelectionHandler: ISelectionHandler;

        private mainSvgElement: d3.Selection<SVGElement>;
        private visualSvgGroup: d3.Selection<SVGElement>;
        private mainGElement: d3.Selection<SVGElement>;
        private xAxisSvgGroup: d3.Selection<SVGElement>;
        private yAxisSvgGroup: d3.Selection<SVGElement>;
        private axisGraphicsContext: d3.Selection<SVGElement>;
        private axisLabelsGroup: d3.selection.Update<string>;
        private legendElement: d3.Selection<SVGElement>;
        private legendElementRoot: d3.Selection<SVGElement>;

        public readonly barClassName: string = Selectors.BarSelect.className;
        private labelGraphicsContext: d3.Selection<any>;
        private labelBackgroundContext: d3.Selection<any>;

        public scrollBar: visualUtils.ScrollBar = new visualUtils.ScrollBar(this);

        private columnWidth: number = 0; // height for bars, width for columns

        public settings: VisualSettings;
        private host: IVisualHost;
        private dataView: DataView;
        private data: VisualData;
        public visualSize: ISize;
        public visualMargin: IMargin;
        private legend: ILegend;
        public legendSize;
        public maxXLabelsWidth: number;

        public static DefaultStrokeSelectionColor: string = "#000";
        public static DefaultStrokeWidth: number = 1;
        public static DefaultStrokeSelectionWidth: number = 1;

        public yTickOffset: number;
        public xTickOffset: number;
        public isNeedToRotate: boolean;

        private behavior: IInteractiveBehavior;
        private interactivityService: IInteractivityService;

        private clearCatcher: d3.Selection<any>;
        private tooltipServiceWrapper: ITooltipServiceWrapper;

        private legendProperties: DataViewObject;

        private hasHighlight: boolean;
        private isLegendNeeded: boolean;

        private metadata: VisualMeasureMetadata;

        private lassoSelection: visualUtils.LassoSelection = new visualUtils.LassoSelection(this);

        private visualTranslation: VisualTranslation;

        private dataPointsByCategories: CategoryDataPoints[];

        constructor(options: VisualConstructorOptions) {
            // Create d3 selection from main HTML element
            const mainElement = d3.select(options.element);

            // Append SVG element to it. This SVG will contain our visual
            this.mainSvgElement = mainElement.append('svg')
                .classed(Selectors.MainSvg.className, true);

            this.mainGElement = this.mainSvgElement.append("g");

            this.clearCatcher = appendClearCatcher(this.mainGElement);
            // Append SVG groups for X and Y axes.
            this.xAxisSvgGroup = this.mainGElement.append("g");
            this.yAxisSvgGroup = this.mainGElement.append("g");
            // Append an svg group that will contain our visual
            this.visualSvgGroup = this.mainGElement.append("g");

            this.axisGraphicsContext = this.mainGElement
                .append("g")
                .attr("class", Selectors.AxisGraphicsContext.className);

            this.host = options.host;

            this.tooltipServiceWrapper = createTooltipServiceWrapper(
                options.host.tooltipService,
                options.element);

            this.interactivityService = createInteractivityService(this.host);

            this.legend = createLegend(options.element,
                false,
                this.interactivityService,
                true);
            this.legendElementRoot = mainElement.selectAll("svg.legend");
            this.legendElement = mainElement.selectAll("svg.legend").selectAll("g");

            this.labelBackgroundContext = this.mainGElement
                .append("g")
                .classed(Selectors.LabelBackgroundContext.className, true);

            this.labelGraphicsContext = this.mainGElement
                .append("g")
                .classed(Selectors.LabelGraphicsContext.className, true);

            this.behavior = new WebBehavior(this);

            this.scrollBar.init(mainElement);

            this.lassoSelection.init(mainElement);
        }

        public clearAll() {
            this.visualSvgGroup.selectAll(Selectors.BarGroupSelect.selectorName).remove();
            this.xAxisSvgGroup.selectAll("*").remove();
            this.yAxisSvgGroup.selectAll("*").remove();
            this.legendElement.selectAll("*").remove();
            this.labelGraphicsContext.selectAll("*").remove();
            this.labelBackgroundContext.selectAll("*").remove();
        }

        public update(options: VisualUpdateOptions) {
            const dataView = options && options.dataViews && options.dataViews[0];

            if (!dataView || options.type === VisualUpdateType.ResizeEnd) {
                return;
            }

            if (!DataViewConverter.IsAxisFilled(dataView) || !DataViewConverter.IsValueFilled(dataView)) {
                this.clearAll();
                return;
            }

            let isResized: boolean = !(options.type === VisualUpdateType.Data || options.type === VisualUpdateType.All);

            this.maxXLabelsWidth = null;

            this.dataView = dataView;
            this.viewport = options.viewport;

            if (!isResized) {
                this.isLegendNeeded = DataViewConverter.IsLegendNeeded(dataView);

                // Parse settings
                this.settings = Visual.parseSettings(dataView);
                this.updateSettings(this.settings, dataView);

                // get legend settings in required format
                this.legendProperties = legendUtils.getLegendProperties(this.settings.legend);
            }

            // Legend
            // legend data creating and rendering
            let legendData = legendUtils.getSuitableLegendData(dataView, this.host, this.settings.legend);
            legendUtils.renderLegend(this.legend, this.mainSvgElement, options.viewport, legendData, this.legendProperties, this.legendElement);

            const legendIsRendered = legendData === undefined ? false : legendData.dataPoints.length > 0;
            const legendColors = legendIsRendered ? legendUtils.getLegendColors(legendData.dataPoints) : [];

            if (!isResized) {
                // Parse data from update options
                this.allDataPoints = DataViewConverter.Convert(dataView, this.host, this.settings, legendColors);

                // Build an array with data points structured by category
                this.dataPointsByCategories = this.buildDataPointsByCategoriesArray();

                // Highlight
                this.hasHighlight = this.allDataPoints.filter(x => x.highlight).length > 0;

                // Set metadata
                this.updateMetaData();

                // Get unique array of category data points
                this.allUniqueCategories = d3.map(this.allDataPoints, d => d.category.toString()).keys();
            }

            this.calculateOffsets();
            // calculate and set visual size and position
            this.calculateVisualSizeAndPosition();

            // Scrollbar
            let scrollBarState: ScrollbarState = this.getScrollbarState();

            this.scrollBar.updateData(scrollBarState, options.type);

            let visibleDataPoints: VisualDataPoint[] = this.scrollBar.getVisibleDataPoints();

            let axes: IAxes = this.createAxes(visibleDataPoints);

            this.data = {
                dataPoints: visibleDataPoints,
                size: this.visualSize,
                axes: axes,
                categories: this.allUniqueCategories,
                legendData: legendData,
                hasHighlight: this.hasHighlight,
                isLegendNeeded: this.isLegendNeeded
            };

            // render for calculate width of labels text
            this.renderAxes();

            // Rerender for dynamic y-axis titles
            this.legendSize = this.getLegendSize(this.settings.legend, this.legendElementRoot);
            this.calculateOffsets();

            this.calculateVisualSizeAndPosition(this.legendSize);

            this.calculateColumnWidth();

            axes = this.createAxes(visibleDataPoints);
            this.data.size = this.visualSize;
            this.data.axes = axes;
            this.interactivityService.applySelectionStateToData(this.data.dataPoints);

            // calculate again after yScale changing
            this.calculateColumnWidth();

            // calculate again after columnWidth changing
            axes = this.createAxes(visibleDataPoints);
            this.data.axes = axes;

            this.renderAxes();

            RenderAxes.rotateXAxisTickLabels(this.isNeedToRotate, this.xAxisSvgGroup);

            this.finalRendering();

            this.scrollBar.update();

            let bars = this.visualSvgGroup.selectAll(Selectors.BarSelect.selectorName).data(visibleDataPoints);
            this.lassoSelection.update(bars);
        }

        getSettings(): VisualSettings {
            return this.settings;
        }

        public getVisualSize(): ISize {
            return this.visualSize;
        }

        getDataView(): DataView {
            return this.dataView;
        }

        public getChartBoundaries(): ClientRect {
            return (<Element>this.yAxisSvgGroup.node()).getBoundingClientRect();
        }

        public getVisualTranslation(): VisualTranslation {
            return this.visualTranslation;
        }

        public getAllDataPoints(): VisualDataPoint[] {
            return this.allDataPoints;
        }

        getAllUniqueCategories(): string[] {
            return this.allUniqueCategories;
        }

        getDataPointsByCategories(): CategoryDataPoints[] {
            return this.dataPointsByCategories;
        }

        private buildDataPointsByCategoriesArray(): CategoryDataPoints[] {
            let dataPointsByCategories: CategoryDataPoints[] = [];
            let categoryIndex: number = 0;
            let categoryName: string = '';
            let previousCategoryName: string = '';
            for (let i: number = 0; i < this.allDataPoints.length; i++) {
                previousCategoryName = categoryName;
                categoryName = this.allDataPoints[i].category.toString();

                if ( i > 0 && categoryName !== previousCategoryName ) {
                    categoryIndex++;
                }

                if ( !dataPointsByCategories[categoryIndex] ) {
                    let category: CategoryDataPoints = {
                        categoryName,
                        dataPoints: []
                    };
                    dataPointsByCategories[categoryIndex] = category;
                }
                dataPointsByCategories[categoryIndex].dataPoints.push(this.allDataPoints[i]);
            }
            return dataPointsByCategories;
        }

        public onScrollPosChanged() {
            const visibleDataPoints: VisualDataPoint[] = this.scrollBar.getVisibleDataPoints();

            let axes: IAxes = this.createAxes(visibleDataPoints);
            let legendData = legendUtils.getSuitableLegendData(this.dataView, this.host, this.settings.legend);
            this.data = {
                dataPoints: visibleDataPoints,
                size: this.visualSize,
                axes: axes,
                categories: this.allUniqueCategories,
                legendData: legendData,
                hasHighlight: this.hasHighlight,
                isLegendNeeded: this.isLegendNeeded
            };

            // render for calculate width of labels text
            this.renderAxes();
            // Rerender for dynamic y-axis titles
            this.legendSize = this.getLegendSize(this.settings.legend, this.legendElementRoot);
            this.calculateOffsets();
            this.calculateVisualSizeAndPosition(this.legendSize);

            this.calculateColumnWidth();

            axes = this.createAxes(visibleDataPoints);
            this.data.size = this.visualSize;
            this.data.axes = axes;
            this.interactivityService.applySelectionStateToData(this.data.dataPoints);

            // calculate again after yScale changing
            this.calculateColumnWidth();

            // calculate again after columnWidth changing
            axes = this.createAxes(visibleDataPoints);
            this.data.axes = axes;
            this.renderAxes();
            RenderAxes.rotateXAxisTickLabels(this.isNeedToRotate, this.xAxisSvgGroup);

            this.finalRendering();
        }

        private updateMetaData(): void {
            const grouped: DataViewValueColumnGroup[] = this.dataView.categorical.values.grouped();
            const source: DataViewMetadataColumn = this.dataView.metadata.columns[0];
            const categories: DataViewCategoryColumn[] = this.dataView.categorical.categories || [];
            this.metadata = metadataUtils.getMetadata(categories, grouped, source);
        }

        private getScrollbarState(): ScrollbarState {
            const categoryType: valueType = axis.getCategoryValueType(this.metadata.cols.category),
                isOrdinal: boolean = axis.isOrdinal(categoryType);

            return this.settings.categoryAxis.axisType === "continuous" && !isOrdinal ? ScrollbarState.Disable : ScrollbarState.Enable;
        }

        private createAxes(dataPoints): IAxes {
            let axesDomains: AxesDomains = RenderAxes.calculateAxesDomains(this.allDataPoints, dataPoints, this.settings, this.metadata);

            let axes: IAxes = RenderAxes.createD3Axes(
                axesDomains,
                this.visualSize,
                this.metadata,
                this.settings,
                this.host,
                this.columnWidth,
                this.maxXLabelsWidth
            );

            return axes;
        }

        private calculateColumnWidth(): void {
            this.columnWidth = visualUtils.calculateBarHeight(
                this.data.dataPoints,
                this.visualSize,
                this.data.categories,
                this.settings.categoryAxis.innerPadding,
                this.data.axes[ScrollableAxisName.X].scale,
                this.settings.categoryAxis.axisType
            );
        }

        private renderAxes(): void {
            visualUtils.calculateBarCoordianates(this.data, this.settings, this.columnWidth);

            RenderAxes.render(
                this.settings,
                this.xAxisSvgGroup,
                this.yAxisSvgGroup,
                this.data.axes
            );
        }

        private finalRendering(): void {
            let labelMaxHeight: number = visualUtils.getLabelsMaxHeight(this.xAxisSvgGroup.selectAll("text")[0]);

            // render axes labels
            RenderAxes.renderLabels(
                this.viewport,
                this.visualMargin,
                this.visualSize,
                [this.data.axes.x.axisLabel, this.data.axes.y.axisLabel],
                this.settings,
                this.data.axes,
                this.axisLabelsGroup,
                this.axisGraphicsContext,
                labelMaxHeight);

                visualUtils.calculateBarCoordianates(this.data, this.settings, this.columnWidth);
            // render main visual
            RenderVisual.render(
                this.data,
                this.visualSvgGroup,
                this.clearCatcher,
                this.interactivityService,
                this.behavior,
                this.tooltipServiceWrapper,
                this.hasHighlight
            );

            let chartHeight: number = (<Element>this.visualSvgGroup.node()).getBoundingClientRect().height;

            visualUtils.calculateLabelCoordinates(
                this.data,
                this.settings.categoryLabels,
                this.metadata,
                chartHeight,
                this.isLegendNeeded
            );

            let filteredDataLabels: VisualDataPoint[] = RenderVisual.filterData(this.data.dataPoints);

            RenderVisual.renderDataLabelsBackground(
                filteredDataLabels,
                this.settings,
                this.labelBackgroundContext
            );

            let dataLabelFormatter: IValueFormatter =
                    formattingUtils.createFormatter(this.settings.categoryLabels.displayUnits,
                                                    this.settings.categoryLabels.precision,
                                                    this.metadata.cols.value,
                                                    formattingUtils.getValueForFormatter(this.data));

            RenderVisual.renderDataLabels(
                filteredDataLabels,
                dataLabelFormatter,
                this.settings,
                this.labelGraphicsContext
            );
        }

        private getLegendSize(settings: legendSettings, legendElementRoot: d3.Selection<SVGElement>): LegendSize {
            // if 'width' or 'height' is '0' it means that we don't need that measure for our calculations
            switch (settings.position) {
                case 'Top': case 'TopCenter':
                    return {
                        width: 0,
                        height: (legendElementRoot.node() as SVGGraphicsElement).getBBox().height
                    };
                case 'Bottom': case 'BottomCenter':
                    return {
                        width: 0,
                        height: (legendElementRoot.node() as SVGGraphicsElement).getBBox().height
                    };
                case 'Left': case 'LeftCenter':
                    return {
                        width: (legendElementRoot.node() as SVGGraphicsElement).getBBox().width,
                        height: 0
                    };
                case 'Right': case 'RightCenter':
                    return {
                        width: (legendElementRoot.node() as SVGGraphicsElement).getBBox().width,
                        height: 0
                    };
                default:
                    return {
                        width: 0,
                        height: 0
                    };
            }
        }

        private updateSettings(settings: VisualSettings, dataView: DataView) {
            const MAX_INNER_PADDING = 50;

            const MAX_CATEGORY_WIDTH = 180;
            const MIN_CATEGORY_WIDTH = 20;

            const MAX_Y_AXIS_WIDTH = 50;
            const MIN_Y_AXIS_WIDTH = 15;

            // for legend
            if (this.settings.legend.legendName.length === 0) {
                if (dataView.categorical.values.source) {
                    settings.legend.legendName = dataView.categorical.values.source.displayName;
                }
            }

            if (this.isLegendNeeded) {
                settings.categoryLabels.labelPosition = settings.categoryLabels.labelPositionForFilledLegend;

                if (settings.categoryLabels.labelPosition === LabelPosition.OutsideEnd) {
                    settings.categoryLabels.labelPosition = LabelPosition.Auto;
                    settings.categoryLabels.labelPositionForFilledLegend = LabelPosition.Auto;
                }
            }
            // for Y-axis
            const categoryAxis = settings.categoryAxis;

            if (categoryAxis.innerPadding > MAX_INNER_PADDING) {
                categoryAxis.innerPadding = MAX_INNER_PADDING;
            }

            if (categoryAxis.minCategoryWidth < MIN_CATEGORY_WIDTH) {
                categoryAxis.minCategoryWidth = MIN_CATEGORY_WIDTH;
            }
            if (categoryAxis.minCategoryWidth > MAX_CATEGORY_WIDTH) {
                categoryAxis.minCategoryWidth = MAX_CATEGORY_WIDTH;
            }

            if (categoryAxis.maximumSize < MIN_Y_AXIS_WIDTH) {
                categoryAxis.maximumSize = MIN_Y_AXIS_WIDTH;
            }
            if (categoryAxis.maximumSize > MAX_Y_AXIS_WIDTH) {
                categoryAxis.maximumSize = MAX_Y_AXIS_WIDTH;
            }

            if (categoryAxis.showTitle && categoryAxis.axisTitle.length === 0) {
                let categories = dataView.categorical.categories;
                categoryAxis.axisTitle = categories ? categories[0].source.displayName : dataView.categorical.values.source.displayName;
            }
            if (!categoryAxis.showTitle) {
                categoryAxis.axisTitle = '';
            }
        }

        private calculateOffsets() {
            let xtickText: d3.selection.Group = this.xAxisSvgGroup.selectAll("text")[0];
            let ytickText: d3.selection.Group = this.yAxisSvgGroup.selectAll("text")[0];

            let showXAxisTitle: boolean = this.settings.categoryAxis.show && this.settings.categoryAxis.showTitle;
            let showYAxisTitle: boolean = this.settings.valueAxis.show && this.settings.valueAxis.showTitle;

            this.yTickOffset = visualUtils.getLabelsMaxWidth(ytickText) + (showYAxisTitle
                                            ? PixelConverter.fromPointToPixel(this.settings.valueAxis.titleFontSize)
                                            : 0);

            let xAxisMaxLableWidth: number = visualUtils.getLabelsMaxWidth(xtickText);
            let innerPadding: number = this.data && this.data.axes ? this.data.axes.x.axis.tickPadding() : 0;

            let isReverted: boolean = false;

            if (this.data && (!this.data.axes.xIsScalar || this.settings.categoryAxis.axisType !== "continuous")) {
                isReverted = !!this.maxXLabelsWidth || xAxisMaxLableWidth > (this.data.axes.x.scale.rangeBand ? this.data.axes.x.scale.rangeBand() : 0 + innerPadding);
            }

            let titleSize: number = (showXAxisTitle
                                        ? PixelConverter.fromPointToPixel(this.settings.categoryAxis.titleFontSize) + 5
                                        : 0);

            this.xTickOffset = (isReverted ? xAxisMaxLableWidth : visualUtils.getLabelsMaxHeight(xtickText)) + titleSize;
            this.isNeedToRotate = isReverted;
        }

        private calculateVisualSizeAndPosition(legendSize: LegendSize = null) {
            // Update the size of our SVG element
            if (this.mainSvgElement) {
                this.mainSvgElement
                    .attr("width", this.viewport.width)
                    .attr("height", this.viewport.height);
            }

            let yHasRightPosition: boolean = this.settings.valueAxis.show && this.settings.valueAxis.position === "right";
            let extendedLeftMargin: boolean = yHasRightPosition || !this.settings.valueAxis.show;
            let extendedRightMargin: boolean = !yHasRightPosition || !this.settings.valueAxis.show;

            // Set up margins for our visual
            this.visualMargin = { top: 17, bottom: 5, left: extendedLeftMargin ? 15 : 5 , right: extendedRightMargin ? 15 : 5  };

            // Set up sizes for axes
            const axesSize: IAxesSize = { xAxisHeight: 10, yAxisWidth: 15 };

            // Calculate the resulting size of visual
            const visualSize: ISize = {
                width: this.viewport.width
                    - this.visualMargin.left
                    - this.visualMargin.right
                    - axesSize.yAxisWidth
                    - (legendSize === null ? 0 : legendSize.width)
                    - this.yTickOffset
                    - (this.scrollBar.isEnabled() ? this.scrollBar.settings.trackSize + this.scrollBar.settings.trackMargin : 0),
                height: this.viewport.height
                    - this.visualMargin.top
                    - this.visualMargin.bottom
                    - axesSize.xAxisHeight
                    - (legendSize === null ? 0 : legendSize.height)
                    - this.xTickOffset,
            };

            if ( this.scrollBar.isEnabled() ) {
                const space: number = this.scrollBar.settings.trackSize + this.scrollBar.settings.trackMargin;
                visualSize.height -= space;
            }

            let axisTitleHeight: number = this.settings.categoryAxis.showTitle ?  visualUtils.GetXAxisTitleHeight(this.settings.categoryAxis) + 5 : 0;

            // 1. calculating maximum possible Y-axis width
            const xAxisMaxWidth = xAxisUtils.getXAxisMaxWidth(visualSize.height + this.xTickOffset, this.settings);
            if (this.xTickOffset > xAxisMaxWidth + axisTitleHeight) {

                // 2. if max width exceeded —— change visual width and offset
                visualSize.height = visualSize.height + this.xTickOffset - xAxisMaxWidth - axisTitleHeight;
                this.xTickOffset = xAxisMaxWidth + axisTitleHeight;

                this.maxXLabelsWidth = xAxisMaxWidth;
            }

            this.visualSize = visualSize;

            // Translate the SVG group to account for visual's margins
            this.visualSvgGroup.attr(
                "transform",
                `translate(${this.visualMargin.left}, ${this.visualMargin.top})`);

            // Move SVG group elements to appropriate positions.
            this.visualTranslation = {
                x: this.visualMargin.left + (yHasRightPosition ? 0 : axesSize.yAxisWidth + this.yTickOffset),
                y: this.visualMargin.top
            };

            this.visualSvgGroup.attr(
                "transform",
                svg.translate(this.visualTranslation.x, this.visualTranslation.y));
            this.xAxisSvgGroup.attr(
                "transform",
                svg.translate(
                    this.visualMargin.left +
                    (yHasRightPosition ? 0 : axesSize.yAxisWidth + this.yTickOffset),
                    this.visualMargin.top + visualSize.height));

            this.yAxisSvgGroup.attr(
                "transform",
                svg.translate(
                    this.visualMargin.left +
                    (yHasRightPosition ? visualSize.width : axesSize.yAxisWidth + this.yTickOffset),
                    this.visualMargin.top));

            this.labelGraphicsContext.attr(
                "transform",
                svg.translate(
                    this.visualMargin.left +
                    (yHasRightPosition ? 0 : axesSize.yAxisWidth + this.yTickOffset),
                    this.visualMargin.top));

            this.labelBackgroundContext.attr(
                "transform",
                svg.translate(
                    this.visualMargin.left +
                    (yHasRightPosition ? 0 : axesSize.yAxisWidth + this.yTickOffset),
                    this.visualMargin.top));
        }

        private static parseSettings(dataView: DataView): VisualSettings {
            return VisualSettings.parse(dataView) as VisualSettings;
        }

        /**
         * This function gets called for each of the objects defined in the capabilities files and allows you to select which of the
         * objects and properties you want to expose to the users in the property pane.
         *
         */
        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] | VisualObjectInstanceEnumerationObject {
            let instanceEnumeration: VisualObjectInstanceEnumeration = VisualSettings.enumerateObjectInstances(this.settings || VisualSettings.getDefault(), options);

            EnumerateObject.setInstances(this.settings, instanceEnumeration, this.data.axes.xIsScalar, this.data);

            return instanceEnumeration;
        }
    }
}
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
    import valueFormatter = powerbi.extensibility.utils.formatting.valueFormatter;
    import TextProperties = powerbi.extensibility.utils.formatting.TextProperties;
    import textMeasurementService = powerbi.extensibility.utils.formatting.textMeasurementService;

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
        public categoriesCount: number;

        public viewport: IViewport;

        public webBehaviorSelectionHandler: ISelectionHandler;

        private mainSvgElement: d3.Selection<SVGElement>;
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

        private dataPointThickness: number = 0; // height for bars, width for columns

        public settings: VisualSettings;
        public host: IVisualHost;
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

        private legendProperties: LegendProperties;

        private hasHighlight: boolean;
        private isLegendNeeded: boolean;
        private isSelectionRestored: boolean = false;

        private metadata: VisualMeasureMetadata;

        private lassoSelection: visualUtils.LassoSelection = new visualUtils.LassoSelection(this);
        private LassoSelectionForSmallMultiple: visualUtils.LassoSelectionForSmallMultiple = new visualUtils.LassoSelectionForSmallMultiple(Selectors.BarSelect, this);

        private visualTranslation: VisualTranslation;
        public skipScrollbarUpdate: boolean = false;

        private dataPointsByCategories: CategoryDataPoints[];

        // adding small multiple
        private mainElement: d3.Selection<any>;
        private mainHtmlElement: HTMLElement;
        private mainDivElement: d3.Selection<any>;
        private chartsContainer: d3.Selection<SVGElement>;
        private barGroup: d3.Selection<SVGElement>;
        public maxYLabelsWidth: number;
        public readonly axesSize: IAxesSize = {xAxisHeight: 10, yAxisWidth: 15};

        constructor(options: VisualConstructorOptions) {
            // Create d3 selection from main HTML element
            this.mainElement = d3.select(options.element);

            this.mainHtmlElement = options.element;

            this.host = options.host;

            this.tooltipServiceWrapper = createTooltipServiceWrapper(
                options.host.tooltipService,
                options.element);

            this.interactivityService = createInteractivityService(this.host);

            const customLegendBehavior = new CustomLegendBehavior( this.saveSelection.bind(this) );
            this.legend = createLegend(
                this.mainHtmlElement,
                false,
                this.interactivityService,
                true,
                null,
                customLegendBehavior
            );
            
            this.behavior = new WebBehavior(this);
            
            this.legendElementRoot = this.mainElement.selectAll("svg.legend");
            this.legendElement = this.mainElement.selectAll("svg.legend").selectAll("g");
        }

        saveSelection(): void {
            const selected = this.mainElement.selectAll(`.legendItem, ${Selectors.BarSelect.selectorName}`)
                .filter(d => d.selected)
                .each(d => {
                    // saving prototype value if no own value (needed for legend)
                    d.identity = d.identity;
                });
            
            const data: any[] = selected.data();
            
            selectionSaveUtils.saveSelection(data, this.host);
        }

        public clearAll() {
            if (this.isSmallMultiple()) {
                this.mainElement.selectAll(".selection-rect").remove();
                this.mainDivElement.selectAll("*").remove();
            } else {
                this.barGroup && this.barGroup.selectAll(Selectors.BarGroupSelect.selectorName).remove();
                this.xAxisSvgGroup && this.xAxisSvgGroup.selectAll("*").remove();
                this.yAxisSvgGroup && this.yAxisSvgGroup.selectAll("*").remove();
                this.legendElement && this.legendElement.selectAll("*").remove();
                this.labelGraphicsContext && this.labelGraphicsContext.selectAll("*").remove();
                this.labelBackgroundContext && this.labelBackgroundContext.selectAll("*").remove();
            }            
        }

        private optionsAreValid(options: VisualUpdateOptions) {
            const dataView = options && options.dataViews && options.dataViews[0];

            if (!dataView || options.type === VisualUpdateType.ResizeEnd) {
                return;
            }

            if (!DataViewConverter.IsCategoryFilled(dataView, Field.Axis) || !DataViewConverter.IsCategoryFilled(dataView, Field.Axis)) {
                this.clearAll();
                return;
            }

            return true;
        }

        private isSmallMultiple(): boolean {
            return !!this.metadata && (this.metadata.idx.columnBy > -1 || this.metadata.idx.rowBy > -1);
        }

        normalChartProcess(options: VisualUpdateOptions): void {
            this.maxXLabelsWidth = null;
            this.dataPointsByCategories = this.buildDataPointsByCategoriesArray();

            this.hasHighlight = this.allDataPoints.filter(x => x.highlight).length > 0;                

            this.categoriesCount = this.dataPointsByCategories.length;

            this.createNormalChartElements();

            this.lassoSelection.init(this.mainElement);

            if (this.isLegendNeeded) {                
                legendUtils.renderLegend(this.legend, this.mainSvgElement, options.viewport, this.legendProperties, this.legendElement);
            } else {
                this.legendElement && this.legendElement.selectAll("*").remove();
                this.mainSvgElement && this.mainSvgElement.style({
                    "margin-top": 0,
                    "margin-bottom": 0,
                    "margin-left": 0,
                    "margin-right": 0
                });
            }

            this.calculateOffsets();
            // calculate and set visual size and position
            this.calculateVisualSizeAndPosition();

            this.scrollBar.updateData(this.getScrollbarState(), options.type);

            let visibleDataPoints: VisualDataPoint[] = this.scrollBar.getVisibleDataPoints();

            let axes: IAxes = this.createAxes(visibleDataPoints);

            this.data = {
                dataPoints: visibleDataPoints,
                size: this.visualSize,
                axes: axes,
                categoriesCount: this.categoriesCount,
                legendData: this.legendProperties.data,
                hasHighlight: this.hasHighlight,
                isLegendNeeded: this.isLegendNeeded,
                isSmallMultiple: this.isSmallMultiple()
            };

            // render for calculate width of labels text
            this.renderAxes();
            // Rerender for dynamic y-axis titles
            this.legendSize = this.isLegendNeeded ? this.calculateLegendSize(this.settings.legend, this.legendElementRoot) : null;

            this.calculateOffsets();
            this.calculateVisualSizeAndPosition(this.legendSize);
            this.calculateDataPointThickness();

            axes = this.createAxes(visibleDataPoints);
            this.data.size = this.visualSize;
            this.data.axes = axes;
            this.interactivityService.applySelectionStateToData(this.data.dataPoints);

            // calculate again after yScale changing
            this.calculateDataPointThickness();

            // calculate again after BarHeight changing
            axes = this.createAxes(visibleDataPoints);
            this.data.axes = axes;

            this.renderAxes();
            RenderAxes.rotateXAxisTickLabels(this.isNeedToRotate, this.xAxisSvgGroup);
            this.finalRendering();
            
            this.scrollBar.update();

            let bars = this.barGroup.selectAll(Selectors.BarSelect.selectorName).data(visibleDataPoints);
            this.LassoSelectionForSmallMultiple.disable();
            this.lassoSelection.update(bars);

            if ( this.settings.constantLine.show && this.settings.constantLine.value ){
                let xWidth: number = (<Element>this.yAxisSvgGroup.selectAll("line").node()).getBoundingClientRect().width;
                RenderVisual.renderConstantLine(this.settings.constantLine, this.barGroup, axes, xWidth);
            }
        }

        private createNormalChartElements(): void {
            this.prepareMainSvgElementForNormalChart();

            this.chartsContainer = this.mainSvgElement.append("g").attr('id', 'chartsContainer');
            
            // Append SVG groups for X and Y axes.
            this.xAxisSvgGroup = this.chartsContainer.append("g").attr('id', 'xAxisSvgGroup');
            this.yAxisSvgGroup = this.chartsContainer.append("g").attr('id', 'yAxisSvgGroup');
            // Append an svg group that will contain our visual
            this.barGroup = this.chartsContainer.append("g").attr('id', 'barGroup');

            this.axisGraphicsContext = this.chartsContainer
                .append("g")
                .attr("class", Selectors.AxisGraphicsContext.className);

            this.labelBackgroundContext = this.chartsContainer
                .append("g")
                .classed(Selectors.LabelBackgroundContext.className, true);

            this.labelGraphicsContext = this.chartsContainer
                .append("g")
                .classed(Selectors.LabelGraphicsContext.className, true);

            this.mainElement.select('.scrollbar-track').remove();
            
            this.scrollBar.init(this.mainElement);
        }

        private prepareMainSvgElementForNormalChart(): void{
            if ( this.mainDivElement ){
                this.mainDivElement.remove();
                this.mainDivElement = null;
            }
            
            // This SVG will contain our visual
            if ( this.mainSvgElement ){
                this.mainSvgElement.selectAll("*").remove();
            } else {
                this.mainSvgElement = this.mainElement.append('svg')
                .classed(Selectors.MainSvg.className, true)
                .attr({
                    width: "100%",
                    height: "100%"
                });
            }
        }

        public update(options: VisualUpdateOptions) {
            if (!this.optionsAreValid(options)) {
                return;
            }

            const dataView = options && options.dataViews && options.dataViews[0];

            this.dataView = dataView;
            this.viewport = options.viewport;

            this.isLegendNeeded = DataViewConverter.IsLegendNeeded(dataView);

            this.updateMetaData();

            this.settings = Visual.parseSettings(dataView);
            this.updateSettings(this.settings, dataView);

            this.legendProperties = legendUtils.setLegendProperties(dataView, this.host, this.settings.legend);

            this.allDataPoints = DataViewConverter.Convert(dataView, this.host, this.settings, this.legendProperties.colors);

            if ( this.isSmallMultiple() ) {
                this.smallMultipleProcess(options.viewport);
            } else {
                this.normalChartProcess(options);
            }

            if (!this.isSelectionRestored) {
                this.restoreSelection();

                this.isSelectionRestored = true;
            }
        }

        private restoreSelection(): void {
            const savedSelection = this.settings.selectionSaveSettings.selection;

            const selected: any[] = this.mainElement.selectAll(`.legendItem, ${Selectors.BarSelect.selectorName}`).data().filter(d => {
                return savedSelection.some(savedD => savedD.identity.key === d.identity.key);
            });

            if (selected.length > 0){
                this.webBehaviorSelectionHandler.handleSelection(selected, false);
            }
        }

        private calculateLabelsSize(settings: smallMultipleSettings): number {
            return settings.showChartTitle ? 120 : 0;
        }

        private calculateTopSpace(settings: smallMultipleSettings): number {

            if (!settings.showChartTitle) {
                return 0;
            }

            let textProperties: TextProperties = {
                fontFamily: settings.fontFamily,
                fontSize: PixelConverter.toString(settings.fontSize)
            };

            let height: number = textMeasurementService.measureSvgTextHeight(textProperties),
                additionalSpace: number = settings.layoutMode === LayoutMode.Flow ? 15 : 0;

            return height + additionalSpace;
        }

        public calculateYAxisSize(): number {

            return 35;
        }

        public calculateXAxisSize(settings: VisualSettings): number {      

            let fontSize: string = PixelConverter.toString(settings.categoryAxis.fontSize);
            let fontFamily: string = settings.categoryAxis.fontFamily;

            let textProperties: TextProperties = {
                fontFamily: fontFamily,
                fontSize: fontSize
            };

            let height: number = textMeasurementService.measureSvgTextHeight(textProperties);

            return height + 8;
        }

        public calculateXAxisSizeForCategorical(values: PrimitiveValue[], settings: VisualSettings, metadata: VisualMeasureMetadata, barHeight: number): number {      
            let formatter: IValueFormatter;

            if (typeof (values.some(x => x && (<any>x).getMonth === 'function'))) {
                if (metadata.cols.category) {
                    formatter = valueFormatter.create({
                        format: valueFormatter.getFormatStringByColumn(metadata.cols.category, true) || metadata.cols.category.format,
                        cultureSelector: this.host.locale
                    });
                } else if (metadata.groupingColumn) {
                    formatter = valueFormatter.create({
                        format: valueFormatter.getFormatStringByColumn(metadata.groupingColumn, true) || metadata.groupingColumn.format,
                        cultureSelector: this.host.locale
                    });
                }
            } else {
                let yAxisFormatString: string = valueFormatter.getFormatStringByColumn(metadata.cols.category) || valueFormatter.getFormatStringByColumn(metadata.groupingColumn);

                formatter = valueFormatter.create({ format: yAxisFormatString });
            }

            let fontSize: string = PixelConverter.toString(settings.categoryAxis.fontSize);
            let fontFamily: string = settings.categoryAxis.fontFamily;

            let maxWidth: number = 0;

            values.forEach(value => {
                let textProperties: TextProperties = {
                    text: formatter.format(value),
                    fontFamily: fontFamily,
                    fontSize: fontSize
                };

                let width: number = textMeasurementService.measureSvgTextWidth(textProperties);
                maxWidth = width > maxWidth ? width : maxWidth;
            });

            if (maxWidth >= barHeight ) {
                return maxWidth + 4;
            }

            return -1;
        }

        public prepareMainDiv(el: d3.Selection<any>) {
            if ( this.mainSvgElement ){
                this.mainSvgElement.remove();
                this.mainSvgElement = null;
            }

            if (this.mainDivElement) {
                this.mainDivElement.selectAll("*").remove();
            } else {
                this.mainDivElement = el.append("div");
            }
        }

        private calculateChartSize(viewport: IViewport,
            settings: smallMultipleSettings,
            leftSpace: number, 
            topSpace: number, 
            rows: number, 
            columns: number,
            legendSize: LegendSize): SmallMultipleSizeOptions {

            const scrollHeight: number = 22,
                scrollWidth: number = 20,
                gapBetweenCharts: number = 10;
            let minHeight: number = settings.minUnitHeight,
                minWidth: number = settings.minUnitWidth;

            let chartHeight: number = 0;
            let chartWidth: number = 0;

            if(settings.layoutMode === LayoutMode.Matrix) {
                let clientHeight: number = viewport.height - topSpace - scrollHeight - legendSize.height;
                let clientWidth: number = viewport.width - leftSpace - scrollWidth - legendSize.width;

                chartHeight = (clientHeight - gapBetweenCharts * rows) / rows;
                chartWidth = (clientWidth - gapBetweenCharts * columns) / columns;
            } else {
                let clientHeight: number = viewport.height - scrollHeight - legendSize.height;
                let clientWidth: number = viewport.width - leftSpace - scrollWidth - legendSize.width;;

                chartHeight = (clientHeight - gapBetweenCharts * rows - topSpace * rows ) / rows;
                chartWidth = (clientWidth - gapBetweenCharts * (columns)) / columns;
            }

            let isVerticalScrollBarNeeded: boolean = chartHeight < minHeight - scrollWidth / rows,
                isHorizontalScrollBarNeeded: boolean = chartWidth < minWidth - scrollHeight / columns;

            if (!isVerticalScrollBarNeeded) {
                chartWidth += scrollHeight / columns;
            }

            if (!isHorizontalScrollBarNeeded) {
                chartHeight += scrollWidth / rows;
            }

            return {
                height: isVerticalScrollBarNeeded ? minHeight : chartHeight,
                width: isHorizontalScrollBarNeeded ? minWidth : chartWidth,
                isHorizontalSliderNeeded: isHorizontalScrollBarNeeded,
                isVerticalSliderNeeded: isVerticalScrollBarNeeded
            }
        }

        private createSmallMultipleAxesByDomains(categoryDomain: any[], valueDomain: any[], visualSize: ISize, maxYAxisLabelWidth: number): IAxes {
            let axesDomains: AxesDomains = {
                yAxisDomain: valueDomain,
                xAxisDomain: categoryDomain
            };

            let axes: IAxes = RenderAxes.createD3Axes(
                axesDomains,
                visualSize,
                this.metadata,
                this.settings,
                this.host,
                true,
                null,
                maxYAxisLabelWidth
            );

            return axes;
        }

        private renderSmallMultipleAxes(dataPoints: VisualDataPoint[], axes: IAxes, xAxisSvgGroup: d3.Selection<SVGElement>, yAxisSvgGroup: d3.Selection<SVGElement>, barHeight: number): void {
            visualUtils.calculateBarCoordianates(dataPoints, axes, this.settings, barHeight, true);

            RenderAxes.render(
                this.settings,
                xAxisSvgGroup,
                yAxisSvgGroup,
                axes
            );
        }

        public smallMultipleProcess(viewport: IViewport) {

            let uniqueColumns: PrimitiveValue[] = this.allDataPoints.map(x => x.columnBy).filter((v, i, a) => a.indexOf(v) === i);
            let uniqueRows: PrimitiveValue[] = this.allDataPoints.map(x => x.rowBy).filter((v, i, a) => a.indexOf(v) === i);
            let uniqueCategories: PrimitiveValue[] = this.allDataPoints.map(x => x.category).filter((v, i, a) => a.indexOf(v) === i);
            
            let leftSpace: number = uniqueRows && uniqueRows.length === 1 && uniqueRows[0] === null ? 0 : this.calculateLabelsSize(this.settings.smallMultiple);
            let topSpace: number = this.calculateTopSpace(this.settings.smallMultiple);            

            let hasHighlight = this.allDataPoints.filter(x => x.highlight).length > 0;

            let marginLeft: number = 10;

            let gapBetweenCharts: number = 10;

            this.prepareMainDiv(this.mainElement);
            this.mainElement.select('.scrollbar-track').remove();      

            let legendSize: LegendSize = {
                width: 0,
                height: 0
            };

            if (this.isLegendNeeded) {
                legendUtils.renderLegend(this.legend, this.mainDivElement, this.viewport, this.legendProperties, this.legendElement);
                legendSize = this.calculateLegendSize(this.settings.legend, this.legendElementRoot);
            } else {
                this.legendElement && this.legendElement.selectAll("*").remove();
                this.mainDivElement && this.mainDivElement.style({
                    "margin-top": 0,
                    "margin-bottom": 0,
                    "margin-left": 0,
                    "margin-right": 0
                });
                legendSize = {
                    height: 0,
                    width: 0
                };
            }

            let layoutMode: LayoutMode = this.settings.smallMultiple.layoutMode;
            let maxRowWidth: number = this.settings.smallMultiple.maxRowWidth;

            let rowsInFlow: number = uniqueColumns.length <= maxRowWidth ? 1 : (Math.floor(uniqueColumns.length / maxRowWidth) + (uniqueColumns.length % maxRowWidth > 0 ? 1 : 0));

            let columns: number = layoutMode === LayoutMode.Matrix ? uniqueColumns.length : Math.min(uniqueColumns.length, maxRowWidth);
            let rows: number = layoutMode === LayoutMode.Matrix ? uniqueRows.length : rowsInFlow * uniqueRows.length;

            let chartSize: SmallMultipleSizeOptions = this.calculateChartSize(viewport, this.settings.smallMultiple, leftSpace, topSpace, rows, columns, legendSize);

            let yAxisSize: number = this.calculateYAxisSize();

            let barsSectionSize: ISize = {
                height: chartSize.height - gapBetweenCharts,
                width: chartSize.width - yAxisSize - gapBetweenCharts * 2
            }

            let xIsScalar: boolean = visualUtils.isScalar(this.metadata.cols.category);
            let barHeight: number = !xIsScalar || this.settings.categoryAxis.axisType === "categorical" ? visualUtils.calculateDataPointThickness(
                null,
                barsSectionSize,
                uniqueCategories.length,
                this.settings.categoryAxis.innerPadding,
                this.settings,
                !xIsScalar) : 0;
            
            let xAxisSizeReverted: number = this.settings.categoryAxis.axisType === "categorical" || !xIsScalar ? this.calculateXAxisSizeForCategorical(uniqueCategories, this.settings, this.metadata, barHeight) : -1;
            let xAxisSize: number = xAxisSizeReverted > 0 ? xAxisSizeReverted : this.calculateXAxisSize(this.settings);

            barsSectionSize.height -= xAxisSize;

            this.mainDivElement.style({
                width: viewport.width - legendSize.width + "px",
                height: viewport.height - legendSize.height + "px",
                "overflow-x": chartSize.isHorizontalSliderNeeded ? "auto" : "hidden",
                "overflow-y": chartSize.isVerticalSliderNeeded ? "auto" : "hidden"
            });

            let maxLabelHeight: number = (chartSize.height) / 100 * this.settings.categoryAxis.maximumSize; 
            let forceRotaion: boolean = xAxisSizeReverted > 0;

            if (this.settings.categoryAxis.maximumSize) {
                if (xAxisSize > maxLabelHeight) {
                    barsSectionSize.height += xAxisSize;
                    xAxisSize = maxLabelHeight;
                    barsSectionSize.height -= xAxisSize;
                    forceRotaion = true;
                } else {
                    maxLabelHeight = Number.MAX_VALUE;
                }    
            } 

            let axes: IAxes;

            const xIsSeparate: boolean = this.settings.categoryAxis.rangeType === AxisRangeType.Separate;
            const yIsSeparate: boolean = this.settings.valueAxis.rangeType === AxisRangeType.Separate;

            const yIsCustom: boolean = this.settings.valueAxis.rangeType === AxisRangeType.Custom;
            const xIsCustom: boolean = this.settings.categoryAxis.rangeType === AxisRangeType.Custom;

            const defaultYDomain: any[] = RenderAxes.calculateValueDomain(this.allDataPoints, this.settings, true);
            const defaultXDomain: any[] = RenderAxes.calculateCategoryDomain(this.allDataPoints, this.settings, this.metadata, true);

            const defaultAxes: IAxes = this.createSmallMultipleAxesByDomains(defaultXDomain, defaultYDomain, barsSectionSize, maxLabelHeight);

            let xDomain: any[] = [],
                yDomain: any[] = [];

            if (!yIsSeparate && !xIsSeparate) {
                axes = defaultAxes;
            } else {
                if (!yIsSeparate) {
                    yDomain = defaultYDomain;
                }

                if (!xIsSeparate) {
                    xDomain = defaultXDomain;
                }
            }

            this.data = {
                axes: axes,
                dataPoints: this.allDataPoints,
                hasHighlight: hasHighlight,
                isLegendNeeded: this.isLegendNeeded,
                legendData: this.legendProperties.data,
                categoriesCount: null,
                isSmallMultiple: this.isSmallMultiple()
            }                       

            let svgHeight: number = 0,
                svgWidth: number = 0;

            if (layoutMode === LayoutMode.Matrix) {
                svgHeight = topSpace + rows * chartSize.height + gapBetweenCharts * (rows),
                svgWidth = leftSpace + columns * chartSize.width + gapBetweenCharts * (columns);
            } else {
                svgHeight = topSpace * rows + rows * chartSize.height + gapBetweenCharts * (rows - 1),
                svgWidth = leftSpace + columns * chartSize.width + gapBetweenCharts * (columns);
            }

            let svgChart = this.mainDivElement
                    .append("svg")
                    .classed("chart", true)
                    .style({
                        width: svgWidth + "px",
                        height: svgHeight + "px"
                    });

            for (let i = 0; i < uniqueRows.length; ++i) {
                for (let j = 0; j < uniqueColumns.length; ++j) {

                    let leftMove: number = 0;
                    let topMove: number = 0;

                    if (layoutMode === LayoutMode.Matrix) {
                        leftMove = gapBetweenCharts / 2 + j * chartSize.width + gapBetweenCharts * j;
                        topMove = topSpace + i * chartSize.height + gapBetweenCharts * i;
                    } else {
                        let xPosition: number = Math.floor(j % maxRowWidth);
                        let yPosition: number = Math.floor(j / maxRowWidth) + i * rowsInFlow;

                        leftMove = xPosition * chartSize.width + gapBetweenCharts * xPosition;
                        topMove = yPosition * chartSize.height + gapBetweenCharts * yPosition + topSpace * yPosition + gapBetweenCharts / 2;
                    }

                    let dataPoints: VisualDataPoint[] = this.allDataPoints.filter(x => x.rowBy === uniqueRows[i]).filter(x => x.columnBy === uniqueColumns[j]);

                    let chart = svgChart
                        .append("g")
                        .attr({
                            transform: svg.translate(leftSpace + leftMove, topMove + topSpace)
                        });

                    let xAxisSvgGroup: d3.Selection<SVGElement> = chart.append("g");
                    let yAxisSvgGroup: d3.Selection<SVGElement> = chart.append("g");

                    let yHasRightPosition: boolean = this.settings.valueAxis.show && this.settings.valueAxis.position === "right";

                    xAxisSvgGroup.attr(
                        "transform",
                        svg.translate(
                            marginLeft + 
                            (yHasRightPosition ? 0 : yAxisSize),
                            barsSectionSize.height));
        
                    yAxisSvgGroup.attr(
                        "transform",
                        svg.translate(
                            marginLeft +
                            (yHasRightPosition ? barsSectionSize.width : yAxisSize),
                            0));        
                            
                    if (yIsSeparate || xIsSeparate) {
                        if (!dataPoints || !dataPoints.length) {
                            axes = defaultAxes;
                        }

                        if (yIsSeparate) {
                            yDomain = dataPoints && dataPoints.length ? RenderAxes.calculateValueDomain(dataPoints, this.settings, true) : defaultYDomain;
                        }

                        if (xIsSeparate) {
                            xDomain = dataPoints && dataPoints.length ? RenderAxes.calculateCategoryDomain(dataPoints, this.settings, this.metadata, true) : defaultXDomain;
                        }

                        axes = !yIsSeparate && !xIsSeparate ? defaultAxes : this.createSmallMultipleAxesByDomains(xDomain, yDomain, barsSectionSize, maxLabelHeight);
                    }
        
                    if (!this.data.axes) {
                        this.data.axes = defaultAxes;
                    }

                    let barHeight: number = !xIsScalar || this.settings.categoryAxis.axisType === "categorical" ? axes.x.scale.rangeBand() : visualUtils.calculateDataPointThickness(
                        dataPoints,
                        barsSectionSize,
                        uniqueCategories.length,
                        this.settings.categoryAxis.innerPadding,
                        this.settings,
                        !xIsScalar
                    );

                    this.renderSmallMultipleAxes(dataPoints, axes, xAxisSvgGroup, yAxisSvgGroup, barHeight);

                    if (xIsCustom) {
                        let divider: number = 1;
                        let xText = xAxisSvgGroup.selectAll("text")[0];

                        let axisWidth = (xText.parentNode  as SVGGraphicsElement).getBBox().width;
                        let maxTextWidth = visualUtils.getLabelsMaxWidth(xText);

                        for (let i = 0; i < xText.length; ++i) {
                            let actualAllAxisTextWidth: number = maxTextWidth * xText.length / divider;

                            if (actualAllAxisTextWidth > axisWidth) {
                                divider += 1;
                            } else {
                                break;
                            }
                        }

                        for (let i = 0; i < xText.length; ++i) { 
                            if (i % divider > 0) {
                                d3.select(xText[i]).remove();
                            }
                        }
                    }

                    if (yIsCustom) {
                        let divider: number = 1;
                        let yText = yAxisSvgGroup.selectAll("text")[0];

                        let axisWidth = (yText.parentNode  as SVGGraphicsElement).getBBox().height;
                        let maxTextWidth = visualUtils.getLabelsMaxHeight(yText);

                        for (let i = 0; i < yText.length; ++i) {
                            let actualAllAxisTextWidth: number = maxTextWidth * yText.length / divider;

                            if (actualAllAxisTextWidth > axisWidth) {
                                divider += 1;
                            } else {
                                break;
                            }
                        }

                        for (let i = 0; i < yText.length; ++i) { 
                            if (i % divider > 0) {
                                d3.select(yText[i]).remove();
                            }
                        }
                    }

                    const labelRotationIsNeeded: boolean = forceRotaion ? true : visualUtils.smallMultipleLabelRotationIsNeeded(
                        xAxisSvgGroup,
                        barHeight,
                        this.settings.categoryAxis,
                        maxLabelHeight
                    );
                    if ( labelRotationIsNeeded ){
                        RenderAxes.rotateXAxisTickLabels(true, xAxisSvgGroup);
                    }

                    let barGroup = chart
                        .append("g")
                        .classed("bar-group", true)
                        .attr({
                            transform: svg.translate(marginLeft + (yHasRightPosition ? 0 : yAxisSize), 0)
                        });

                   // visualUtils.calculateBarCoordianates(dataPoints, axes, this.settings, barHeight);

                    let interactivityService = this.interactivityService,
                        hasSelection: boolean = interactivityService.hasSelection();
                    interactivityService.applySelectionStateToData(dataPoints);

                    const barSelect = barGroup
                        .selectAll(Selectors.BarSelect.selectorName)
                        .data(dataPoints);

                    barSelect.enter().append("rect")
                        .attr("class", Selectors.BarSelect.className);

                    barSelect.exit()
                        .remove();
                    
                    barSelect
                        .attr({
                            height: d => {
                                return d.barCoordinates.height;
                            },
                            width: d => {
                                return d.barCoordinates.width;
                            },
                            x: d => {
                                return d.barCoordinates.x;
                            },
                            y: d => {
                                return d.barCoordinates.y;
                            },
                            fill: d => d.color
                        });
        
                    barSelect.style({
                        "fill-opacity": (p: VisualDataPoint) => visualUtils.getFillOpacity(
                            p.selected,
                            p.highlight,
                            !p.highlight && hasSelection,
                            !p.selected && hasHighlight),
                        "stroke": (p: VisualDataPoint)  => {
                            if (hasSelection && visualUtils.isSelected(p.selected,
                                p.highlight,
                                !p.highlight && hasSelection,
                                !p.selected && hasHighlight)) {
                                    return Visual.DefaultStrokeSelectionColor;
                                }                        
        
                            return p.color;
                        },
                        "stroke-width": p => {
                            if (hasSelection && visualUtils.isSelected(p.selected,
                                p.highlight,
                                !p.highlight && hasSelection,
                                !p.selected && hasHighlight)) {
                                return Visual.DefaultStrokeSelectionWidth;
                            }
        
                            return Visual.DefaultStrokeWidth;
                        }
                    });

                    RenderVisual.renderTooltip(barSelect, this.tooltipServiceWrapper);

                    visualUtils.calculateLabelCoordinates(
                        this.data,
                        this.settings.categoryLabels,
                        this.metadata,
                        chartSize.width,
                        this.isLegendNeeded,
                        dataPoints
                    );

                    let labelGraphicsContext = barGroup
                            .append("g")
                            .classed(Selectors.LabelGraphicsContext.className, true);

                    RenderVisual.renderDataLabelsForSmallMultiple(
                        this.data,
                        this.settings,
                        labelGraphicsContext,
                        this.metadata,
                        dataPoints
                    );

                    let labelBackgroundContext = barGroup
                        .append("g")
                        .classed(Selectors.LabelBackgroundContext.className, true);

                    RenderVisual.renderDataLabelsBackgroundForSmallMultiple(
                        this.data,
                        this.settings,
                        labelBackgroundContext,
                        dataPoints
                    );

                    if (this.settings.smallMultiple.showChartTitle && layoutMode === LayoutMode.Flow) {
                        RenderVisual.renderSmallMultipleTopTitle({
                            chartElement: svgChart,
                            chartSize: chartSize,
                            columns: uniqueColumns,
                            index: j,
                            leftSpace: leftMove + leftSpace,
                            topSpace: topMove,
                            textHeight: topSpace,
                            rows: uniqueRows,
                            xAxisLabelSize: xAxisSize
                        }, this.settings.smallMultiple);
                    }

                    if (this.settings.valueAxis.show) {
                        let xWidth: number = (<Element>yAxisSvgGroup.selectAll("line").node()).getBoundingClientRect().width;
                        if (axes.y.dataDomain[0] <= this.settings.constantLine.value && this.settings.constantLine.value <= axes.y.dataDomain[1]) {
                            RenderVisual.renderConstantLine(this.settings.constantLine, barGroup, axes, xWidth);
                        }
                    }                    
                }
            }

            if (this.settings.smallMultiple.showSeparators) {
                RenderVisual.renderSmallMultipleLines({
                    chartElement: svgChart,
                    chartSize: chartSize,
                    columns: uniqueColumns,
                    rows: uniqueRows,
                    leftSpace: leftSpace,
                    topSpace: topSpace,
                    xAxisLabelSize: xAxisSize,
                    rowsInFlow: rowsInFlow
                }, this.settings.smallMultiple);
            }            

            if (this.settings.smallMultiple.showChartTitle) {
                RenderVisual.renderSmallMultipleTitles({
                    chartElement: svgChart,
                    chartSize: chartSize,
                    columns: uniqueColumns,
                    leftSpace: leftSpace,
                    topSpace: topSpace,
                    rows: uniqueRows,
                    xAxisLabelSize: xAxisSize,
                    rowsInFlow: rowsInFlow
                }, this.settings.smallMultiple);
            }            

            const legendBucketFilled: boolean = !!(this.dataView.categorical && this.dataView.categorical.values && this.dataView.categorical.values.source);
            this.lassoSelection.disable();
            this.LassoSelectionForSmallMultiple.init(this.mainElement);
            this.LassoSelectionForSmallMultiple.update(svgChart, svgChart.selectAll(Selectors.BarSelect.selectorName), legendBucketFilled);

            if (this.interactivityService) {
                this.interactivityService.applySelectionStateToData(this.allDataPoints);

                let behaviorOptions: WebBehaviorOptions = {
                    bars: this.mainElement.selectAll(Selectors.BarSelect.selectorName),
                    clearCatcher: d3.select( document.createElement('div') ),
                    interactivityService: this.interactivityService,
                    host: this.host,
                    selectionSaveSettings: this.settings.selectionSaveSettings
                };

                this.interactivityService.bind(this.allDataPoints, this.behavior, behaviorOptions);
            }
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
            return (<Element>this.clearCatcher.node()).getBoundingClientRect();
        }

        public getVisualTranslation(): VisualTranslation {
            return this.visualTranslation;
        }

        public getAllDataPoints(): VisualDataPoint[] {
            return this.allDataPoints;
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
                if (this.allDataPoints[i].category == null) {
                    continue;
                }

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
                categoriesCount: this.categoriesCount,
                legendData: legendData,
                hasHighlight: this.hasHighlight,
                isLegendNeeded: this.isLegendNeeded,
                isSmallMultiple: this.isSmallMultiple()
            };

            // render for calculate width of labels text
            this.renderAxes();
            // Rerender for dynamic y-axis titles
            this.legendSize = this.isLegendNeeded ? this.calculateLegendSize(this.settings.legend, this.legendElementRoot) : null;
            this.calculateOffsets();
            this.calculateVisualSizeAndPosition(this.legendSize);

            this.calculateDataPointThickness();

            axes = this.createAxes(visibleDataPoints);
            this.data.size = this.visualSize;
            this.data.axes = axes;
            this.interactivityService.applySelectionStateToData(this.data.dataPoints);

        /*    // calculate again after yScale changing
            this.calculateBarHeight();

            // calculate again after BarHeight changing
            axes = this.createAxes(visibleDataPoints);
            this.data.axes = axes;*/

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

        private createAxes(dataPoints, isSmallMultiple = false): IAxes {
            let axesDomains: AxesDomains = RenderAxes.calculateAxesDomains(this.allDataPoints, dataPoints, this.settings, this.metadata, isSmallMultiple);

            let axes: IAxes = RenderAxes.createD3Axes(
                axesDomains,
                this.visualSize,
                this.metadata,
                this.settings,
                this.host,
                isSmallMultiple,
                this.dataPointThickness,
                this.maxXLabelsWidth
            );

            return axes;
        }

        private calculateDataPointThickness(): void {
            this.dataPointThickness = visualUtils.calculateDataPointThickness(
                this.data.dataPoints,
                this.visualSize,
                this.data.categoriesCount,
                this.settings.categoryAxis.innerPadding,
                this.settings
            );
        }

        private renderAxes(): void {
            visualUtils.calculateBarCoordianates(this.data.dataPoints, this.data.axes, this.settings, this.dataPointThickness);

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

                visualUtils.calculateBarCoordianates(this.data.dataPoints, this.data.axes, this.settings, this.dataPointThickness);
            // render main visual
            RenderVisual.render(
                this.data,
                this.barGroup,
                this.clearCatcher,
                this.interactivityService,
                this.behavior,
                this.tooltipServiceWrapper,
                this.host,
                this.hasHighlight,
                this.settings
            );

            let chartHeight: number = (<Element>this.barGroup.node()).getBoundingClientRect().height;

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

            let xWidth: number = (<Element>this.yAxisSvgGroup.selectAll("line").node()).getBoundingClientRect().width;
            RenderVisual.renderConstantLine(this.settings.constantLine, this.barGroup, this.data.axes, xWidth);
        }

        private calculateLegendSize(settings: legendSettings, legendElementRoot: d3.Selection<SVGElement>): LegendSize {
            // if 'width' or 'height' is '0' it means that we don't need that measure for our calculations
            switch (settings.position) {
                case 'Top': case 'TopCenter':
                case 'Bottom': case 'BottomCenter':
                    return {
                        width: 0,
                        height: (legendElementRoot.node() as SVGGraphicsElement).getBBox().height
                    };
                case 'Left': case 'LeftCenter':
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

            if (this.isSmallMultiple() && (!visualUtils.categoryIsScalar(this.metadata) || this.settings.categoryAxis.axisType === "categorical")) {
                settings.categoryAxis.rangeType = settings.categoryAxis.rangeTypeNoScalar;
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

            if (typeof settings.selectionSaveSettings.selection === "string") {
                settings.selectionSaveSettings.selection = JSON.parse(settings.selectionSaveSettings.selection);
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

            this.calculateVisualMargin();

            const showXAxisTitle: boolean = this.settings.categoryAxis.show && this.settings.categoryAxis.showTitle;
            const yAxisTitleThickness: number = showXAxisTitle ? visualUtils.GetXAxisTitleHeight(this.settings.categoryAxis) + 5 : 0;

            this.calculateVisualSize( legendSize, yAxisTitleThickness);

            const xAxisMaxWidth = xAxisUtils.getXAxisMaxWidth(this.visualSize.height + this.xTickOffset, this.settings);

            if (this.xTickOffset > xAxisMaxWidth + yAxisTitleThickness) {
                this.xTickOffset = xAxisMaxWidth + yAxisTitleThickness;

                this.maxXLabelsWidth = xAxisMaxWidth;
            }

            this.calculateVisualPosition();
        }

        private calculateVisualMargin(): void {
            let yHasRightPosition: boolean = this.settings.valueAxis.show && this.settings.valueAxis.position === "right";
            let extendedLeftMargin: boolean = yHasRightPosition || !this.settings.categoryAxis.show;
            let extendedRightMargin: boolean = !yHasRightPosition || !this.settings.categoryAxis.show;

            // Set up margins for our visual
            this.visualMargin = { top: 5, bottom: 5, left: extendedLeftMargin ? 15 : 5 , right: extendedRightMargin ? 15 : 5  };
        }

        private calculateVisualSize(legendSize: LegendSize, xAxisTitleThickness: number): void {
            const visualSize: ISize = {
                width: this.viewport.width
                    - this.visualMargin.left
                    - this.visualMargin.right
                    - this.axesSize.yAxisWidth
                    - (legendSize === null ? 0 : legendSize.width)
                    - this.yTickOffset,
                height: this.viewport.height
                    - this.visualMargin.top
                    - this.visualMargin.bottom
                    - this.axesSize.xAxisHeight
                    - (legendSize === null ? 0 : legendSize.height)
                    - this.xTickOffset
                    - (this.scrollBar.isEnabled() ? this.scrollBar.settings.trackSize : 0),
            };

            // set maximum Y-labels width according to the Y-axis formatting options (maximumSize parameter)
            const xAxisMaxWidth = xAxisUtils.getXAxisMaxWidth(visualSize.height + this.xTickOffset, this.settings);
            if (this.xTickOffset > xAxisMaxWidth + xAxisTitleThickness) {
                visualSize.height = visualSize.height + this.xTickOffset - xAxisMaxWidth - xAxisTitleThickness;
                this.xTickOffset = xAxisMaxWidth + xAxisTitleThickness;
                this.maxXLabelsWidth = xAxisMaxWidth;
            }

            this.visualSize = visualSize;
        }

        private calculateVisualPosition(): void {
            // Translate the SVG group to account for visual's margins
            this.chartsContainer.attr(
                "transform",
                `translate(${this.visualMargin.left}, ${this.visualMargin.top})`);

            // Move SVG group elements to appropriate positions.
            this.visualTranslation = {
                x: this.visualMargin.left,// + (yHasRightPosition ? 0 : axesSize.yAxisWidth + this.yTickOffset),
                y: this.visualMargin.top
            };

            const yHasLeftPosition: boolean = this.settings.valueAxis.show && this.settings.valueAxis.position === "left";

            const translateX: number = yHasLeftPosition ? this.axesSize.yAxisWidth + this.yTickOffset : 0;
                
            this.xAxisSvgGroup.attr(
                "transform",
                svg.translate(
                    translateX,
                    this.visualMargin.top + this.visualSize.height));

            this.yAxisSvgGroup.attr(
                "transform",
                svg.translate(
                    (yHasLeftPosition ? this.axesSize.yAxisWidth + this.yTickOffset : this.visualSize.width),
                    this.visualMargin.top));

            this.barGroup.attr(
                "transform",
                svg.translate(
                    translateX,
                    this.visualMargin.top));

            this.labelGraphicsContext.attr(
                "transform",
                svg.translate(
                    translateX,
                    this.visualMargin.top));

            this.labelBackgroundContext.attr(
                "transform",
                svg.translate(
                    translateX,
                    this.visualMargin.top));
        }

        private yAxisHasRightPosition(): boolean {
            return this.settings.valueAxis.show && this.settings.valueAxis.position === "right";
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

            let instances: VisualObjectInstance[] = (instanceEnumeration as VisualObjectInstanceEnumerationObject).instances;
            let instance: VisualObjectInstance = instances[0];

            if (instance.objectName === "legend" && !this.isLegendNeeded) {
                return null;
            }

            if (instance.objectName === "smallMultiple" && !this.isSmallMultiple()) {
                return null;
            }

            EnumerateObject.setInstances(this.settings, instanceEnumeration, this.data.axes.xIsScalar, this.data);

            return instanceEnumeration;
        }
    }
}
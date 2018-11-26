module powerbi.extensibility.visual {
    import svg = powerbi.extensibility.utils.svg;
    import CssConstants = svg.CssConstants;

    // powerbi.extensibility.utils.type
    import PixelConverter = powerbi.extensibility.utils.type.PixelConverter;
    import axis = powerbi.extensibility.utils.chart.axis;
    import createAxis = powerbi.extensibility.utils.chart.axis.createAxis;
    import valueFormatter = powerbi.extensibility.utils.formatting.valueFormatter;
    import valueType = powerbi.extensibility.utils.type.ValueType;
    import textMeasurementService = powerbi.extensibility.utils.formatting.textMeasurementService;
    import TextProperties = powerbi.extensibility.utils.formatting.TextProperties;

    module Selectors {
        export const AxisLabelSelector = CssConstants.createClassAndSelector("axisLabel");
    }

    export class RenderAxes {
        private static DefaultAxisXTickPadding: number = 10;
        private static DefaultAxisYTickPadding: number = 10;

        private static AxisLabelOffset: number = 2;
        private static TickLabelAndTitleGap: number = 5 ;
        private static YAxisLabelTransformRotate: string = "rotate(-90)";
        private static DefaultDY: string = "1em";

        public static createD3Axes(
            axesDomains: AxesDomains,
            size: ISize,
            metadata: VisualMeasureMetadata,
            settings: VisualSettings,
            host: IVisualHost,
            dataPointThickness: number,
            maxXLabelsWidth = null): IAxes {

            let yAxisProperties: axis.IAxisProperties = null;

            let valueAxisScale: string = settings.valueAxis.axisScale;

            let yAxisPrecision: any = settings.valueAxis && settings.valueAxis.precision != null && settings.valueAxis.precision >= 0
                ? settings.valueAxis.precision.toString()
                : undefined;

            if (yAxisPrecision === 0) {
                yAxisPrecision = yAxisPrecision.toString();
            }

            let yAxisFormatString: string = valueFormatter.getFormatStringByColumn(metadata.cols.value);

            yAxisProperties = createAxis({
                pixelSpan: size.height,
                dataDomain: axesDomains.yAxisDomain,
                metaDataColumn: metadata.cols.value,
                formatString: yAxisFormatString,
                outerPadding: 0,
                innerPadding: 0,
                isScalar: true,
                isVertical: true,
                isCategoryAxis: false,
                scaleType: valueAxisScale,
                useTickIntervalForDisplayUnits: true,
                axisDisplayUnits: settings.valueAxis.displayUnits,
                disableNice: settings.valueAxis.start != null || settings.valueAxis.end != null,
                axisPrecision: yAxisPrecision
            });

            yAxisProperties.axis
                .innerTickSize(-size.width)
                .tickPadding(RenderAxes.DefaultAxisXTickPadding)
                .orient(settings.valueAxis.position)
                .outerTickSize(1);

            yAxisProperties.axisLabel = settings.valueAxis.showTitle ? metadata.labels.x : "";

            // create Y axis
            let xAxisProperties: axis.IAxisProperties = null;
            let xAxisFormatString: string = valueFormatter.getFormatStringByColumn(metadata.cols.category) || valueFormatter.getFormatStringByColumn(metadata.groupingColumn);

            const categoryType: valueType = axis.getCategoryValueType(metadata.cols.category);
            let isOrdinal: boolean = axis.isOrdinal(categoryType);

            let xIsScalar: boolean = !isOrdinal;
            let categoryAxisScale: string = settings.categoryAxis.axisType === "categorical" ? "linear" : settings.categoryAxis.axisScale;
            let axisType: string = !xIsScalar ? "categorical" : settings.categoryAxis.axisType;

            let dateColumnFormatter = null;

            if (metadata.cols.category) {
                dateColumnFormatter = valueFormatter.create({
                    format: valueFormatter.getFormatStringByColumn(metadata.cols.category, true) || metadata.cols.category.format,
                    cultureSelector: host.locale
                });
            } else if (metadata.groupingColumn) {
                dateColumnFormatter = valueFormatter.create({
                    format: valueFormatter.getFormatStringByColumn(metadata.groupingColumn, true) || metadata.groupingColumn.format,
                    cultureSelector: host.locale
                });
            }

            let innerPadding: number = settings.categoryAxis.innerPadding / 100;
            const outerPadding: number = xIsScalar && axisType === "continuous" ? dataPointThickness / 2 : 0;

            let xAxisPrecision: any = settings.categoryAxis && settings.categoryAxis.precision != null && settings.categoryAxis.precision >= 0
                ? settings.categoryAxis.precision.toString()
                : undefined;

            if (xAxisPrecision === 0) {
                xAxisPrecision = xAxisPrecision.toString();
            }

            let fontSize: string = PixelConverter.toString(settings.categoryAxis.fontSize);
            let fontFamily: string = settings.categoryAxis.fontFamily;

            xAxisProperties = createAxis({
                pixelSpan: size.width,
                dataDomain: axesDomains.xAxisDomain,
                metaDataColumn: metadata.cols.category || metadata.groupingColumn,
                formatString: xAxisFormatString,
                outerPadding: outerPadding,
                innerPadding: innerPadding,
                scaleType: xIsScalar ? categoryAxisScale : undefined,
                isScalar: xIsScalar && axisType === "continuous",
                isVertical: false,
                isCategoryAxis: true,
                useTickIntervalForDisplayUnits: true,
                axisDisplayUnits: settings.categoryAxis.displayUnits,
                axisPrecision: xAxisPrecision,
                disableNice: axisType === "continuous" && (settings.categoryAxis.start != null || settings.categoryAxis.end != null),
                getValueFn: (index: number, dataType: valueType): any => {

                    if (dataType.dateTime && dateColumnFormatter) {
                        let options = {};

                        if (xIsScalar && axisType === "continuous") {
                            options = {
                                month: "short",
                                year: "numeric"
                            };
                        } else {
                            options = {
                                day: "numeric",
                                month: "numeric",
                                year: "numeric"
                            };
                        }

                        let formattedString: string = dateColumnFormatter.format(new Date(index).toLocaleString("en-US", options));

                        if (maxXLabelsWidth) {

                            let textProperties: TextProperties = {
                                text: formattedString,
                                fontFamily: fontFamily,
                                fontSize: fontSize
                            };

                            return textMeasurementService.getTailoredTextOrDefault(textProperties, maxXLabelsWidth);
                        }

                        return formattedString;
                    }

                    if (maxXLabelsWidth) {

                        let textProperties: TextProperties = {
                            text: index.toString(),
                            fontFamily: fontFamily,
                            fontSize: fontSize
                        };

                        return  textMeasurementService.getTailoredTextOrDefault(textProperties, maxXLabelsWidth);
                    }
                    return index;
                }
            });

            // For Y axis, make ticks appear full-width.
            xAxisProperties.axis
                .tickPadding(RenderAxes.DefaultAxisYTickPadding)
                .orient("bottom")
                .innerTickSize(0)
                .outerTickSize(0);

            xAxisProperties.axisLabel = settings.categoryAxis.showTitle ? metadata.labels.y : "";

            return {
                x: xAxisProperties,
                y: yAxisProperties,
                xIsScalar: xIsScalar
            };
        }

        public static rotateXAxisTickLabels(toRotate: boolean, xAxisSvgGroup: d3.Selection<SVGElement>): void {
            let axisText = xAxisSvgGroup.selectAll("g").selectAll("text");
            if (toRotate) {
                axisText.attr({
                    "transform": "rotate(-90)",
                    "dx": "-5.5px",
                    "dy": "-0.5em"
                });

                axisText.style({
                    "text-anchor": "end"
                });
            } else {
                axisText.attr({
                    "transform": "rotate(0)",
                    "dx": "0"
                });

                axisText.style({
                    "text-anchor": "middle"
                });
            }
        }

        public static render(settings: VisualSettings,
                        xAxisSvgGroup: d3.Selection<SVGElement>,
                        yAxisSvgGroup: d3.Selection<SVGElement>,
                        axes: IAxes) {
            // Now we call the axis funciton, that will render an axis on our visual.
            if (settings.valueAxis.show) {
                yAxisSvgGroup.call(axes.y.axis);
                let axisText = yAxisSvgGroup.selectAll("g").selectAll("text");
                let axisLines = yAxisSvgGroup.selectAll("g").selectAll("line");

                let valueAxisSettings: valueAxisSettings = settings.valueAxis;

                let color: string = valueAxisSettings.axisColor.toString();
                let fontSize: string = PixelConverter.toString(valueAxisSettings.fontSize);
                let fontFamily: string = valueAxisSettings.fontFamily;
                let gridlinesColor: string = valueAxisSettings.gridlinesColor.toString();
                let strokeWidth: string = PixelConverter.toString(valueAxisSettings.strokeWidth);
                let showGridlines: DataViewPropertyValue = valueAxisSettings.showGridlines;
                let lineStyle: DataViewPropertyValue = valueAxisSettings.lineStyle;

                let strokeDasharray = visualUtils.getLineStyleParam(lineStyle);

                axisText.style({
                    "fill": color,
                    "font-size": fontSize,
                    "font-family": fontFamily
                });

                axisLines.style({
                    "stroke": gridlinesColor,
                    "stroke-width": strokeWidth,
                    "stroke-dasharray": strokeDasharray
                });

                if (showGridlines) {
                    axisLines.style("opacity", "1");
                } else {
                    axisLines.style("opacity", "0");
                }

            } else {
                yAxisSvgGroup.selectAll("*").remove();
            }

            if (settings.categoryAxis.show) {
                xAxisSvgGroup.call(axes.x.axis);

                let axisText = xAxisSvgGroup.selectAll("g").selectAll("text");

                let categoryAxisSettings: categoryAxisSettings = settings.categoryAxis;
                let color: string = categoryAxisSettings.axisColor.toString();
                let fontSize: string = PixelConverter.toString(categoryAxisSettings.fontSize);
                let fontFamily: string = categoryAxisSettings.fontFamily;

                axisText.style({
                    "fill": color,
                    "stroke": "none",
                    "font-size": fontSize,
                    "font-family": fontFamily
                });

            } else {
                xAxisSvgGroup.selectAll("*").remove();
            }

        }

        public static renderLabels(
            viewport: IViewport,
            visualMargin: IMargin,
            visualSize: ISize,
            axisLabelsData: Array<string>,
            settings: VisualSettings,
            axes: IAxes,
            axisLabelsGroup: d3.selection.Update<string>,
            axisGraphicsContext: d3.Selection<SVGElement>,
            tickLabelHeight: number) {

            const margin: IMargin = visualMargin,
                width: number = viewport.width,
                yAxisOrientation: string = "right",
                showY1OnRight: boolean = yAxisOrientation === settings.valueAxis.position;

            let showXAxisTitle: boolean = settings.categoryAxis.show && settings.categoryAxis.showTitle;
            let showYAxisTitle: boolean = settings.valueAxis.show && settings.valueAxis.showTitle;

            if (!showXAxisTitle) {
                axisLabelsData[0] = null;
            }

            if (!showYAxisTitle) {
                axisLabelsData[1] = null;
            }

            axisLabelsGroup = axisGraphicsContext.selectAll("*")
                .data(axisLabelsData);

            // When a new category added, create a new SVG group for it.
            axisLabelsGroup.enter()
                .append("text")
                .attr("class", Selectors.AxisLabelSelector.className);

            // For removed categories, remove the SVG group.
            axisLabelsGroup.exit()
                .remove();

            let xColor: string = settings.categoryAxis.axisTitleColor;
            let xFontSize: number = PixelConverter.fromPointToPixel(settings.categoryAxis.titleFontSize);
            let xFontSizeString: string = PixelConverter.toString(settings.categoryAxis.titleFontSize);
            let xTitle: DataViewPropertyValue = settings.categoryAxis.axisTitle;
            let xAxisStyle: DataViewPropertyValue = settings.categoryAxis.titleStyle;
            let xAxisFontFamily: string = settings.categoryAxis.titleFontFamily;

            let yColor: string = settings.valueAxis.axisTitleColor;
            let yFontSize: number = parseInt(settings.valueAxis.titleFontSize.toString());
            let yFontSizeString: string = PixelConverter.toString(yFontSize);
            let yTitle: DataViewPropertyValue = settings.valueAxis.axisTitle;
            let yAxisStyle: DataViewPropertyValue = settings.valueAxis.titleStyle;
            let yAxisFontFamily: string = settings.valueAxis.titleFontFamily;

            axisLabelsGroup
                .style({ "text-anchor": "middle" })
                .text(d => d)
                .call((text: d3.Selection<any>) => {
                    const textSelectionX: d3.Selection<any> = d3.select(text[0][0]);

                    textSelectionX.attr({
                        "transform": svg.translate(
                            (width + margin.left) / RenderAxes.AxisLabelOffset,
                            visualSize.height + xFontSize + margin.top + tickLabelHeight + this.TickLabelAndTitleGap)
                    });

                    if (showXAxisTitle && xTitle && xTitle.toString().length > 0) {
                        textSelectionX.text(xTitle as string);
                    }

                    if (showXAxisTitle && xAxisStyle) {
                        let newTitle: string = visualUtils.getTitleWithUnitType(textSelectionX.text(), xAxisStyle, axes.x);

                        textSelectionX.text(newTitle);
                    }

                    textSelectionX.style({
                        "fill": xColor,
                        "font-size": xFontSizeString,
                        "font-family": xAxisFontFamily
                    });

                    const textSelectionY: d3.Selection<any> = d3.select(text[0][1]);

                    textSelectionY.attr({
                        "transform": showY1OnRight ? RenderAxes.YAxisLabelTransformRotate : RenderAxes.YAxisLabelTransformRotate,
                        "y": showY1OnRight
                            ? width - margin.right - yFontSize
                            : 0,
                        "x": -((visualSize.height + margin.top + margin.bottom) / RenderAxes.AxisLabelOffset),
                        "dy": RenderAxes.DefaultDY
                    });

                    if (showYAxisTitle && yTitle && yTitle.toString().length > 0) {
                        textSelectionY.text(yTitle as string);
                    }

                    if (showYAxisTitle) {
                        let newTitle: string = visualUtils.getTitleWithUnitType(textSelectionY.text(), yAxisStyle, axes.y);

                        textSelectionY.text(newTitle);
                    }

                    textSelectionY.style({
                        "fill": yColor,
                        "font-size": yFontSizeString,
                        "font-family": yAxisFontFamily
                    });
                });
        }

        public static calculateAxesDomains(allDatapoint: VisualDataPoint[], visibleDatapoints: VisualDataPoint[], settings: VisualSettings, metadata: VisualMeasureMetadata): AxesDomains {

            let minValue: number = d3.min(allDatapoint, d => <number>d.sum);
            let maxValue: number = d3.max(allDatapoint, d => <number>d.sum);

            minValue = minValue < 0 ? minValue : 0;
            maxValue = maxValue > 0 ? maxValue : 0;

            let dataDomainMinY: number = minValue;
            let dataDomainMaxY: number = maxValue;

            const categoryType: valueType = axis.getCategoryValueType(metadata.cols.category);
            let isOrdinal: boolean = axis.isOrdinal(categoryType);

            let dataDomainX = visibleDatapoints.map(d => <any>d.category);
            let xIsScalar: boolean = !isOrdinal;
            let axisType: string = !xIsScalar ? "categorical" : settings.categoryAxis.axisType;

            if (xIsScalar && axisType === "continuous") {
                let dataDomainMinX: number = d3.min(visibleDatapoints, d => <number>d.category);
                let dataDomainMaxX: number = d3.max(visibleDatapoints, d => <number>d.category);

                let start = settings.categoryAxis.start;
                let end = settings.categoryAxis.end;

                dataDomainX = [start != null ? settings.categoryAxis.start : dataDomainMinX, end != null ? end : dataDomainMaxX];
            }

            let constantLineValue: number = settings.constantLine.value;

            if (constantLineValue || constantLineValue === 0) {
                dataDomainMinY = dataDomainMinY > constantLineValue ? constantLineValue : dataDomainMinY;
                dataDomainMaxY = dataDomainMaxY < constantLineValue ? constantLineValue : dataDomainMaxY;
            }

            let start = settings.valueAxis.start;
            let end = settings.valueAxis.end;

            return {
                xAxisDomain: dataDomainX,
                yAxisDomain: [start != null ? start : dataDomainMinY, end != null ? end : dataDomainMaxY]
            };
        }
    }
}
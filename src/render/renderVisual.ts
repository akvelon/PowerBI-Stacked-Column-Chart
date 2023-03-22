module powerbi.extensibility.visual {
    import svg = powerbi.extensibility.utils.svg;
    import CssConstants = svg.CssConstants;
    import IInteractiveBehavior = powerbi.extensibility.utils.interactivity.IInteractiveBehavior;
    import IInteractivityService = powerbi.extensibility.utils.interactivity.IInteractivityService;
    import TooltipEventArgs = powerbi.extensibility.utils.tooltip.TooltipEventArgs;
    import ITooltipServiceWrapper = powerbi.extensibility.utils.tooltip.ITooltipServiceWrapper;
    import UpdateSelection = d3Selection.Update;
    import dataLabelUtils = powerbi.extensibility.utils.chart.dataLabel.utils;
    import PixelConverter = powerbi.extensibility.utils.type.PixelConverter;
    import ValueFormatter = powerbi.extensibility.utils.formatting.valueFormatter;
    import IValueFormatter = powerbi.extensibility.utils.formatting.IValueFormatter;
    import translate = powerbi.extensibility.utils.svg.translate;
    import ClassAndSelector = powerbi.extensibility.utils.svg.CssConstants.ClassAndSelector;
    import createClassAndSelector = powerbi.extensibility.utils.svg.CssConstants.createClassAndSelector;
    import TextProperties = powerbi.extensibility.utils.formatting.TextProperties;    
    import TextMeasurementService = powerbi.extensibility.utils.formatting.textMeasurementService;

    module Selectors {
        export const BarSelect = CssConstants.createClassAndSelector("bar");
        export const BarGroupSelect = CssConstants.createClassAndSelector("bar-group");
        export const AxisLabelSelector = CssConstants.createClassAndSelector("axisLabel");
    }

    export class RenderVisual {
        private static Label: ClassAndSelector = createClassAndSelector("label");

        public static render(
            data: VisualData,
            visualSvgGroup: d3Selection<SVGElement>,
            clearCatcher: d3Selection<any>,
            visualInteractivityService: IInteractivityService,
            visualBehavior: IInteractiveBehavior,
            tooltipServiceWrapper: ITooltipServiceWrapper,
            host: IVisualHost,
            hasHighlight: boolean,
            settings: VisualSettings) {
            // Select all bar groups in our chart and bind them to our categories.
            // Each group will contain a set of bars, one for each of the values in category.
            const barGroupSelect = visualSvgGroup.selectAll(Selectors.BarGroupSelect.selectorName)
                .data([data.dataPoints]);

            // When a new category added, create a new SVG group for it.
            barGroupSelect.enter()
                .append("g")
                .attr("class", Selectors.BarGroupSelect.className);

            // For removed categories, remove the SVG group.
            barGroupSelect.exit()
                .remove();

            // Update the position of existing SVG groups.
            // barGroupSelect.attr("transform", d => `translate(0, ${data.axes.y(d.category)})`);

            // Now we bind each SVG group to the values in corresponding category.
            // To keep the length of the values array, we transform each value into object,
            // that contains both value and total count of all values in this category.
            const barSelect = barGroupSelect
                .selectAll(Selectors.BarSelect.selectorName)
                .data(data.dataPoints);

            // For each new value, we create a new rectange.
            barSelect.enter().append("rect")
                .attr("class", Selectors.BarSelect.className);

            // Remove rectangles, that no longer have matching values.
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

            let interactivityService = visualInteractivityService,
                hasSelection: boolean = interactivityService.hasSelection();

            barSelect.style({
                "fill-opacity": (p: VisualDataPoint) => visualUtils.getFillOpacity(
                    p.selected,
                    p.highlight,
                    !p.highlight && hasSelection,
                    !p.selected && data.hasHighlight),
                "stroke": (p: VisualDataPoint)  => {
                    if ((hasHighlight || hasSelection) && visualUtils.isSelected(p.selected,
                        p.highlight,
                        !p.highlight && hasSelection,
                        !p.selected && hasHighlight)) {
                            return Visual.DefaultStrokeSelectionColor;
                        }                        

                    return p.color;
                },
                "stroke-width": p => {
                    if ((hasHighlight || hasSelection) && visualUtils.isSelected(p.selected,
                        p.highlight,
                        !p.highlight && hasSelection,
                        !p.selected && hasHighlight)) {
                        return Visual.DefaultStrokeSelectionWidth;
                    }

                    return Visual.DefaultStrokeWidth;
                }
            });

            if (interactivityService) {
                interactivityService.applySelectionStateToData(data.dataPoints);

                let behaviorOptions: WebBehaviorOptions = {
                    bars: barSelect,
                    clearCatcher: clearCatcher,
                    interactivityService: visualInteractivityService,
                    host: host,
                    selectionSaveSettings: settings.selectionSaveSettings
                };

                interactivityService.bind(data.dataPoints, visualBehavior, behaviorOptions);
            }

            this.renderTooltip(barSelect, tooltipServiceWrapper);
        }

        public static renderDataLabelsBackground(
            dataPoints: VisualDataPoint[],
            settings: VisualSettings,
            dataLabelsBackgroundContext: d3Selection<any>): void {

            let labelSettings: categoryLabelsSettings = settings.categoryLabels;
            let isHorizontal: boolean = labelSettings.orientation === LabelOrientation.Horizontal;

            dataLabelsBackgroundContext.selectAll("*").remove();

            if (!labelSettings.showBackground) {
                return;
            }

            let backgroundSelection: UpdateSelection<VisualDataPoint> = dataLabelsBackgroundContext
                        .selectAll(RenderVisual.Label.selectorName)
                        .data(dataPoints);

            backgroundSelection
                .enter()
                .append("svg:rect");

            backgroundSelection
                .attr({
                    height: d => {
                        return d.labelCoordinates.height + DataLabelHelper.labelBackgroundHeightPadding * (isHorizontal ? 1 : 2);
                    },
                    width: d => {
                        return d.labelCoordinates.width + DataLabelHelper.labelBackgroundWidthPadding;
                    },
                    x: d => {
                        return d.labelCoordinates.x - (isHorizontal ? DataLabelHelper.labelBackgroundXShift : d.labelCoordinates.width);
                    },
                    y: d => {
                        return d.labelCoordinates.y - d.labelCoordinates.height + (isHorizontal ? -DataLabelHelper.labelBackgroundYShift : DataLabelHelper.labelBackgroundYShift);
                    },
                    rx: 4,
                    ry: 4,
                    fill: settings.categoryLabels.backgroundColor
                });

            backgroundSelection.style({
                "fill-opacity": (100 - settings.categoryLabels.transparency) / 100,
                "pointer-events": "none"
            });

            backgroundSelection
                .exit()
                .remove();
        }

        public static renderDataLabelsBackgroundForSmallMultiple(
            data: VisualData,
            settings: VisualSettings,
            dataLabelsBackgroundContext: d3Selection<any>,
            dataPoints: VisualDataPoint[] = null): void {

            let labelSettings: categoryLabelsSettings = settings.categoryLabels;

            dataLabelsBackgroundContext.selectAll("*").remove();

            if (!labelSettings.showBackground) {
                return;
            }

            let dataPointsArray: VisualDataPoint[] = this.filterData(dataPoints || data.dataPoints),
                backgroundSelection: UpdateSelection<VisualDataPoint> = dataLabelsBackgroundContext
                        .selectAll(RenderVisual.Label.selectorName)
                        .data(dataPointsArray);

            backgroundSelection
                .enter()
                .append("svg:rect");

            backgroundSelection
                .attr({
                    height: d => {
                        return d.labelCoordinates.height + DataLabelHelper.labelBackgroundHeightPadding;
                    },
                    width: d => {
                        return d.labelCoordinates.width + DataLabelHelper.labelBackgroundWidthPadding;
                    },
                    x: d => {
                        return d.labelCoordinates.x - DataLabelHelper.labelBackgroundXShift;
                    },
                    y: d => {
                        return d.labelCoordinates.y - d.labelCoordinates.height - DataLabelHelper.labelBackgroundYShift;
                    },
                    rx: 4,
                    ry: 4,
                    fill: settings.categoryLabels.backgroundColor                    
                });

            backgroundSelection.style({
                "fill-opacity": (100 - settings.categoryLabels.transparency) / 100,
                "pointer-events": "none"
            });

            backgroundSelection
                .exit()
                .remove();
        }

        public static renderDataLabels(
            dataPoints: VisualDataPoint[],
            dataLabelFormatter: IValueFormatter,
            settings: VisualSettings,
            dataLabelsContext: d3Selection<any>): void {

            let labelSettings: categoryLabelsSettings = settings.categoryLabels;

            dataLabelsContext.selectAll("*").remove();

            if (!labelSettings.show) {
                return;
            }

            let  labelSelection: UpdateSelection<VisualDataPoint> = dataLabelsContext
                        .selectAll(RenderVisual.Label.selectorName)
                        .data(dataPoints);

            labelSelection
                .enter()
                .append("svg:text");

            let fontSizeInPx: string = PixelConverter.fromPoint(labelSettings.fontSize);
            let fontFamily: string = labelSettings.fontFamily ? labelSettings.fontFamily : dataLabelUtils.LabelTextProperties.fontFamily;

            labelSelection
                .attr("transform", (p: VisualDataPoint) => {
                    return translate(p.labelCoordinates.x, p.labelCoordinates.y) + (labelSettings.orientation === LabelOrientation.Horizontal ? "" : "rotate(-90)");
                });

            labelSelection
                .style({
                    "fill": labelSettings.color,
                    "font-size": fontSizeInPx,
                    "font-family": fontFamily,
                    "pointer-events": "none"
                })
                .text((p: VisualDataPoint) => dataLabelFormatter.format(p.value));

            labelSelection
                .exit()
                .remove();
        }

        public static renderDataLabelsForSmallMultiple(
            data: VisualData,
            settings: VisualSettings,
            dataLabelsContext: d3Selection<any>,
            metadata: VisualMeasureMetadata,
            dataPoints: VisualDataPoint[] = null): void {

            let labelSettings: categoryLabelsSettings = settings.categoryLabels;

            dataLabelsContext.selectAll("*").remove();

            if (!labelSettings.show) {
                return;
            }

            let dataPointsArray: VisualDataPoint[] = this.filterData(dataPoints || data.dataPoints),
                labelSelection: UpdateSelection<VisualDataPoint> = dataLabelsContext
                        .selectAll(RenderVisual.Label.selectorName)
                        .data(dataPointsArray);

            let dataLabelFormatter: IValueFormatter =
                    formattingUtils.createFormatter(labelSettings.displayUnits,
                                                    labelSettings.precision,
                                                    metadata.cols.value,
                                                    formattingUtils.getValueForFormatter(data));

            labelSelection
                .enter()
                .append("svg:text");

            let fontSizeInPx: string = PixelConverter.fromPoint(labelSettings.fontSize);
            let fontFamily: string = labelSettings.fontFamily ? labelSettings.fontFamily : dataLabelUtils.LabelTextProperties.fontFamily;

            labelSelection
                .attr("transform", (p: VisualDataPoint) => {
                    return translate(p.labelCoordinates.x, p.labelCoordinates.y);
                });

            labelSelection
                .style({
                    "fill": labelSettings.color,
                    "font-size": fontSizeInPx,
                    "font-family": fontFamily,
                    "pointer-events": "none"
                })
                .text((p: VisualDataPoint) => dataLabelFormatter.format(p.value));

            labelSelection
                .exit()
                .remove();
        }

        public static renderSmallMultipleTopTitle(options: SmallMultipleOptions, settings: smallMultipleSettings) {
            let uniqueColumns: PrimitiveValue[] = options.columns,
                index: number = options.index,
                chartSize: ISize = options.chartSize,
                chartElement: d3Selection<any> = options.chartElement,
                leftSpace: number = options.leftSpace,
                topSpace: number = options.topSpace,
                textHeight: number = options.textHeight,
                fontSizeInPx: string = PixelConverter.fromPoint(settings.fontSize),
                fontFamily: string = settings.fontFamily;

            let topTitles: d3Selection<SVGElement> = chartElement.append("svg");
            let topTitlestext: d3Selection.Update<PrimitiveValue> = topTitles.selectAll("*").data([uniqueColumns[index]]);

            topTitlestext.enter()
                .append("text")
                .attr("class", Selectors.AxisLabelSelector.className);

            // For removed categories, remove the SVG group.
            topTitlestext.exit()
                .remove();

            let textProperties: TextProperties = {
                fontFamily,
                fontSize: fontSizeInPx
            }

            topTitlestext
                .style({ 
                    "text-anchor": "middle",
                    "font-size": fontSizeInPx,
                    "font-family": fontFamily,
                    "fill": settings.fontColor
                })
                .attr({
                    dy: "0.3em"
                })
                .text(d => {
                    if (d) {
                        textProperties.text = d && d.toString();
                        return TextMeasurementService.getTailoredTextOrDefault(textProperties, chartSize.width - 10);
                    }         
                    
                    return null;
                })
                .call((text: d3Selection<any>) => {
                    const textSelectionX: d3Selection<any> = d3.select(text[0][0]);
                    let x = leftSpace + chartSize.width / 2;

                    textSelectionX.attr({
                        "transform": svg.translate(x, topSpace + textHeight / 2)
                    });                    
                });
        }

        public static filterData(dataPoints: VisualDataPoint[]): VisualDataPoint[] {
            let filteredDatapoints: VisualDataPoint[] = [];
            let validCoordinatesDataPoints: VisualDataPoint[] = dataPoints.filter(x => x.labelCoordinates);

            for (let index in validCoordinatesDataPoints) {
                let dataPoint = validCoordinatesDataPoints[index];
                let coords: Coordinates = dataPoint.labelCoordinates;
                let isIntersected: boolean = false;

                for (let i in filteredDatapoints) {
                    let filteredDatapoint: VisualDataPoint = filteredDatapoints[i];
                    let filteredCoods: Coordinates = filteredDatapoint.labelCoordinates;

                    if (coords.x < filteredCoods.x + filteredCoods.width + 8
                        && coords.x + coords.width > filteredCoods.x + 8
                        && coords.y < filteredCoods.y + filteredCoods.height + 2
                        && coords.y + coords.height > filteredCoods.y + 2 ) {
                        isIntersected = true;
                        break;
                    }
                }

                if (!isIntersected) {
                    filteredDatapoints.push(dataPoint);
                }
            }

            return filteredDatapoints;
        }

        public static renderTooltip(selection: d3Selection.Update<any>, tooltipServiceWrapper: ITooltipServiceWrapper): void {
            tooltipServiceWrapper.addTooltip(
                selection,
                (tooltipEvent: TooltipEventArgs<VisualDataPoint>) => {
                    return (<VisualDataPoint>tooltipEvent.data).tooltips;
                },
                null,
                true);
        }

        public static renderConstantLine(settings: constantLineSettings, element: d3Selection<SVGElement>, axes: IAxes, width: number) {
            let line: d3Selection<any> = element.select(".const-line");

            let yValue: number = settings.value;

            if (yValue < axes.y.dataDomain[0]) {
                yValue = axes.y.dataDomain[0];
            } else if (yValue > axes.y.dataDomain[1]) {
                yValue = axes.y.dataDomain[1];
            }

            let y = axes.y.scale(yValue);
            let x = axes.x.scale(axes.x.dataDomain[0]);

            if (line[0][0]) {
                element.selectAll("line").remove();
            } 

            if (settings.position === Position.InFront) {
                line = element.append("line");
            } else {
                line = element.insert("line", ".bar-group");
            }

            line
                .classed("const-line", true)                    
                .style({
                    display: settings.show ? "unset" : "none",
                    stroke: settings.lineColor,
                    "stroke-opacity": 1 - settings.transparency / 100,
                    "stroke-width": "3px"
                })
                .attr({
                    "y2": y,
                    "x2": width,
                    "y1": y
                });

            if (settings.lineStyle === LineStyle.Dotted) {
                line.style({
                    "stroke-dasharray": "1, 5",
                    "stroke-linecap": "round"
                });
            } else if (settings.lineStyle === LineStyle.Dashed) {
                line.style({
                    "stroke-dasharray": "5, 5"
                });
            }

            let textProperties: TextProperties = {
                fontFamily: "wf_standard-font, helvetica, arial, sans-serif",
                fontSize: "10px"
            };            

            let text: string = this.getLineText(settings);
            let textWidth: number = TextMeasurementService.measureSvgTextWidth(textProperties, text);
            let textHeight: number = TextMeasurementService.estimateSvgTextHeight(textProperties);

            let label: d3Selection<any> = element.select(".const-label");

            if (label[0][0]) {
                element.selectAll("text").remove();
            }

            if (settings.show && settings.dataLabelShow) {
                label = element
                            .append("text")
                            .classed("const-label", true);

                label
                    .attr({
                        transform: this.getTranslateForStaticLineLabel(x, y, textWidth, textHeight, settings, axes, width)
                    });

                label
                    .text(text)
                    .style({
                        "font-family": "wf_standard-font, helvetica, arial, sans-serif",
                        "font-size": "10px",
                        fill: settings.fontColor
                    });
            }
        }

        private static getLineText(settings: constantLineSettings): string {
            let displayUnits: number = settings.displayUnits;
            let precision: number = settings.precision;

            let formatter = ValueFormatter.create({
                value: displayUnits,
                value2: 0,
                precision: precision,
                format: "0"
            });

            switch(settings.text) {
                case Text.Name: {
                    return settings.name;
                }
                case Text.Value: {
                    return formatter.format(settings.value);
                }
                case Text.NameAndValue: {
                    return settings.name + " " + formatter.format(settings.value);
                }
            }
        }

        private static getTranslateForStaticLineLabel(x: number, y: number, textWidth: number, textHeight: number, settings: constantLineSettings, axes: IAxes, width: number) {
            let positionAlong: number;
            const marginAlong: number = 8;
            if (settings.horizontalPosition === HorizontalPosition.Left) {
                positionAlong = marginAlong;
            } else {
                positionAlong = width - textWidth - marginAlong;
            }

            const marginAcross: number = 5;
            let positionAcross: number;
            if (settings.verticalPosition === VerticalPosition.Top) {
                positionAcross = y - (marginAcross + textHeight);
            } else {
                positionAcross = y + (marginAcross + textHeight);
            }

            let minPosition: number = axes.y.scale(axes.y.dataDomain[1]);
            let maxPosition: number = axes.y.scale(axes.y.dataDomain[0]);

            if (positionAcross <= minPosition) {
                positionAcross = minPosition + marginAcross;
            } else if(positionAcross >= maxPosition) {
                positionAcross = maxPosition - (textHeight + marginAcross);
            }

            return translate(positionAlong, positionAcross);
        }

        private static gapBetweenCharts: number = 10;

        public static renderSmallMultipleLines(options: SmallMultipleOptions, settings: smallMultipleSettings) {

            let uniqueRows: PrimitiveValue[] = options.rows,
                uniqueColumns: PrimitiveValue[] = options.columns,
                chartSize: ISize = options.chartSize,
                chartElement: d3Selection<any> = options.chartElement,
                leftSpace: number = options.leftSpace,
                topSpace: number = options.topSpace,
                rowsInFlow: number = options.rowsInFlow;

            for (let i = 1; i < uniqueRows.length; ++i) {
                let y: number = 0;
                if (settings.layoutMode === LayoutMode.Matrix) {
                    y = topSpace * 2 + i * chartSize.height + this.gapBetweenCharts * (i - 1);
                } else {
                    y = topSpace * i * rowsInFlow + i * chartSize.height * rowsInFlow + this.gapBetweenCharts * (i * rowsInFlow - 1) + this.gapBetweenCharts / 2;
                }

                let line = chartElement.append("line").style({
                    "stroke": "#aaa",
                    "stroke-width": 1
                });

                line.attr({
                    x1: 0,//leftSpace + gapBetweenCharts / 2,
                    x2: leftSpace + uniqueColumns.length * chartSize.width + this.gapBetweenCharts * uniqueColumns.length,
                    y1: y,
                    y2: y
                })
            }

            if (settings.layoutMode === LayoutMode.Matrix) {
                for (let j = 1; j < uniqueColumns.length; ++j) { 
                    let x = leftSpace + j * chartSize.width + this.gapBetweenCharts * j;
    
                    let line = chartElement.append("line").style({
                        "stroke": "#aaa",
                        "stroke-width": 1
                    });
    
                    line.attr({
                        x1: x,
                        x2: x,
                        y1: 0,
                        y2: topSpace + uniqueRows.length * chartSize.height + this.gapBetweenCharts * uniqueRows.length
                    });
                }
            }            
        }

        public static renderSmallMultipleTitles(options: SmallMultipleOptions, settings: smallMultipleSettings) { 
            let uniqueColumns: PrimitiveValue[] = options.columns,
                uniqueRows: PrimitiveValue[] = options.rows,
                chartSize: ISize = options.chartSize,
                chartElement: d3Selection<any> = options.chartElement,
                leftSpace: number = options.leftSpace,                
                topSpace: number = options.topSpace,
                fontSizeInPx: string = PixelConverter.fromPoint(settings.fontSize),
                fontFamily: string = settings.fontFamily,
                rowsInFlow: number = options.rowsInFlow;

            if (settings.layoutMode === LayoutMode.Matrix) {
                let topTitles: d3Selection<SVGElement> = chartElement.append("svg");
                let topTitlestext: d3Selection.Update<PrimitiveValue> = topTitles.selectAll("*").data(uniqueColumns);

                topTitlestext.enter()
                    .append("text")
                    .attr("class", Selectors.AxisLabelSelector.className);

                // For removed categories, remove the SVG group.
                topTitlestext.exit()
                    .remove();

                let textProperties: TextProperties = {
                    fontFamily,
                    fontSize: fontSizeInPx
                }        

                topTitlestext
                    .style({ 
                        "text-anchor": "middle",
                        "font-size": fontSizeInPx,
                        "font-family": fontFamily,
                        "fill": settings.fontColor
                    })
                    .attr({
                        dy: "1em"
                    })
                    .text(d => {
                        if (d || d === 0) {
                            textProperties.text = d.toString();
                            return TextMeasurementService.getTailoredTextOrDefault(textProperties, chartSize.width - 10);
                        }         
                        
                        return null;
                    })
                    .call((text: d3Selection<any>) => {
                        for (let j = 0; j < uniqueColumns.length; ++j) { 
                            const textSelectionX: d3Selection<any> = d3.select(text[0][j]);
                            let x = leftSpace + j * chartSize.width + chartSize.width / 2 + this.gapBetweenCharts * j;

                            textSelectionX.attr({
                                "transform": svg.translate(x, topSpace / 2)
                            });
                        }
                    });
            }

            const leftTitleSpace: number = 120;

            let textProperties: TextProperties = {
                fontFamily,
                fontSize: fontSizeInPx
            }

            let leftTitles: d3Selection<SVGElement> = chartElement.append("svg");
            let leftTitlesText: d3Selection.Update<PrimitiveValue> = leftTitles.selectAll("*").data(uniqueRows);

            leftTitlesText.enter()
                .append("text")
                .attr("class", Selectors.AxisLabelSelector.className);

            // For removed categories, remove the SVG group.
            leftTitlesText.exit()
                .remove();

            leftTitlesText
                .style({ 
                    "text-anchor": "middle",
                    "font-size": fontSizeInPx,
                    "font-family": fontFamily,
                    "fill": settings.fontColor
                })
                .text(d => {
                    if (d) {
                        textProperties.text = d && d.toString();
                        return TextMeasurementService.getTailoredTextOrDefault(textProperties, leftTitleSpace);
                    }         
                    
                    return null;
                })
                .call((text: d3Selection<any>) => {
                    for (let i = 0; i < uniqueRows.length; ++i) { 
                        const textSelectionX: d3Selection<any> = d3.select(text[0][i]);
                        let y = 0;

                        if (settings.layoutMode === LayoutMode.Flow) {
                            
                            let previousChartGroupHeight: number = i * rowsInFlow * chartSize.height + this.gapBetweenCharts * i * rowsInFlow + topSpace * rowsInFlow * i;
                            y = previousChartGroupHeight + rowsInFlow * chartSize.height / 2 + topSpace;
                        } else {
                            y = i * chartSize.height + chartSize.height / 2 + topSpace * 2 + this.gapBetweenCharts * i;
                        }                        

                        textSelectionX.attr({
                            "transform": svg.translate(leftSpace / 2, y)
                        });
                    }
                });
        }
    }
}
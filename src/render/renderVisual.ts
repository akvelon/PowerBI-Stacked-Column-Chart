module powerbi.extensibility.visual {
    import svg = powerbi.extensibility.utils.svg;
    import CssConstants = svg.CssConstants;
    import IInteractiveBehavior = powerbi.extensibility.utils.interactivity.IInteractiveBehavior;
    import IInteractivityService = powerbi.extensibility.utils.interactivity.IInteractivityService;
    import TooltipEventArgs = powerbi.extensibility.utils.tooltip.TooltipEventArgs;
    import ITooltipServiceWrapper = powerbi.extensibility.utils.tooltip.ITooltipServiceWrapper;
    import UpdateSelection = d3.selection.Update;
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
    }

    export class RenderVisual {
        private static Label: ClassAndSelector = createClassAndSelector("label");

        public static render(
            data: VisualData,
            visualSvgGroup: d3.Selection<SVGElement>,
            clearCatcher: d3.Selection<any>,
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
            dataLabelsBackgroundContext: d3.Selection<any>): void {

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

        public static renderDataLabels(
            dataPoints: VisualDataPoint[],
            dataLabelFormatter: IValueFormatter,
            settings: VisualSettings,
            dataLabelsContext: d3.Selection<any>): void {

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

        private static renderTooltip(selection: d3.selection.Update<any>, tooltipServiceWrapper: ITooltipServiceWrapper): void {
            tooltipServiceWrapper.addTooltip(
                selection,
                (tooltipEvent: TooltipEventArgs<VisualDataPoint>) => {
                    return (<VisualDataPoint>tooltipEvent.data).tooltips;
                },
                null,
                true);
        }

        public static renderConstantLine(settings: constantLineSettings, element: d3.Selection<SVGElement>, axes: IAxes, width: number) {
            let line: d3.Selection<any> = element.select(".const-line");
            let y = axes.y.scale(settings.value);
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
                fontFamily: "wf_standard-font, helvetica, arial, sans-serif;",
                fontSize: "10px"
            };            

            let text: string = this.getLineText(settings);
            let textWidth: number = TextMeasurementService.measureSvgTextWidth(textProperties, text);
            let textHeight: number = TextMeasurementService.estimateSvgTextHeight(textProperties);

            let label: d3.Selection<any> = element.select(".const-label");

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
    }
}
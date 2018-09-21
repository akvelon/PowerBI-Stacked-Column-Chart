module powerbi.extensibility.visual.visualUtils {
    import IAxisProperties = powerbi.extensibility.utils.chart.axis.IAxisProperties;
    import TextMeasurmentService = powerbi.extensibility.utils.formatting.textMeasurementService;
    import TextProperties = powerbi.extensibility.utils.formatting.TextProperties;
    import IValueFormatter = powerbi.extensibility.utils.formatting.IValueFormatter;
    import TextMeasurementService = powerbi.extensibility.utils.formatting.textMeasurementService;

    const DisplayUnitValue: number = 1;

    export function calculateBarCoordianates(data: VisualData, settings: VisualSettings, barHeight: number): void {
        let isCategoricalAxisType: boolean = settings.categoryAxis.axisType === "categorical";

        data.dataPoints.forEach(point => {
            let height, width, x, y: number;

            if (data.axes.xIsScalar && !isCategoricalAxisType) {
                width = barHeight < 0 ? 0 : barHeight;
            } else {
                width = data.axes.x.scale.rangeBand();
            }

            if (point.shiftValue) {
                y = data.axes.y.scale(point.shiftValue);
            } else {
                let yValue = 0;
                if (data.axes.y.dataDomain[0] > 0) {
                    yValue = data.axes.y.dataDomain[0];
                }
                y = data.axes.y.scale(yValue);
            }

            let heightValue: number = point.valueForHeight as number;
            if (data.axes.y.scale(heightValue + point.shiftValue) < 0) {
                height = 1;
            } else {
                height =  y - data.axes.y.scale(heightValue + point.shiftValue);
            }

            if (data.axes.xIsScalar && !isCategoricalAxisType) {
                x = data.axes.x.scale(point.category) - barHeight / 2;
            } else {
                x = data.axes.x.scale(point.category);
            }

            point.barCoordinates = {
                height: height < 1 && height !== 0 ? 1 : height,
                width: width,
                x: x,
                y: y - height
            };
        });
    }

    export function calculateLabelCoordinates(data: VisualData,
                                            settings: categoryLabelsSettings,
                                            metadata: VisualMeasureMetadata,
                                            chartHeight: number,
                                            isLegendRendered: boolean) {
        if (!settings.show) {
            return;
        }

        let dataPointsArray: VisualDataPoint[] = data.dataPoints;

        let dataLabelFormatter: IValueFormatter = formattingUtils.createFormatter(settings.displayUnits,
                                                                        settings.precision,
                                                                        metadata.cols.value,
                                                                        formattingUtils.getValueForFormatter(data));

        let textPropertiesForWidth: TextProperties = formattingUtils.getTextProperties(settings);
        let textPropertiesForHeight: TextProperties = formattingUtils.getTextPropertiesForHeightCalculation(settings);

        dataPointsArray.forEach(dataPoint => {
            let formattedText: string = dataLabelFormatter.format(dataPoint.value);
            textPropertiesForHeight.text = formattedText;

            let isHorizontal: boolean = settings.orientation === LabelOrientation.Horizontal;

            let textHeight: number = isHorizontal ?
                                                TextMeasurmentService.estimateSvgTextHeight(textPropertiesForWidth)
                                                : TextMeasurmentService.measureSvgTextWidth(textPropertiesForWidth, formattedText);

            let textWidth: number = isHorizontal ?
                                                TextMeasurmentService.measureSvgTextWidth(textPropertiesForWidth, formattedText)
                                                : TextMeasurmentService.estimateSvgTextHeight(textPropertiesForWidth);

            let barWidth: number = dataPoint.barCoordinates.width;

            if (settings.overflowText || textWidth +
                (settings.showBackground ? DataLabelHelper.labelBackgroundHeightPadding : 0) < barWidth) {

                let dx: number = dataPoint.barCoordinates.x + dataPoint.barCoordinates.width / 2 + (isHorizontal ? -(textWidth) / 2 : (textWidth) / 3 ),
                    dy: number = DataLabelHelper.calculatePositionShift(settings, textHeight, dataPoint, chartHeight, isLegendRendered);

                if (dy !== null) {
                    dataPoint.labelCoordinates = {
                        x: dx,
                        y: dy,
                        width: textWidth,
                        height: textHeight
                    };
                } else {
                    dataPoint.labelCoordinates = null;
                }
            } else {
                dataPoint.labelCoordinates = null;
            }
        });
    }

    export function getNumberOfValues(dataView: DataView): number {
        const columns: DataViewMetadataColumn[] = dataView.metadata.columns;
        let valueFieldsCount: number = 0;

        for (let columnName in columns) {
            const column: DataViewMetadataColumn = columns[columnName];

            if (column.roles && column.roles[Field.Value]) {
                ++valueFieldsCount;
            }
        }

        return valueFieldsCount;
    }

    export function getLineStyleParam(lineStyle) {
        let strokeDasharray;

        switch (lineStyle) {
            case "solid":
                strokeDasharray = "none";
                break;
            case "dashed":
                strokeDasharray = "7, 5";
                break;
            case "dotted":
                strokeDasharray = "2, 2";
                break;
        }

        return strokeDasharray;
    }

    export function getUnitType(xAxis: IAxisProperties): string {
        if (xAxis.formatter
            && xAxis.formatter.displayUnit
            && xAxis.formatter.displayUnit.value > DisplayUnitValue) {

            return xAxis.formatter.displayUnit.title;
        }

        return null;
    }

    export function getTitleWithUnitType(title, axisStyle, axis: IAxisProperties): string {
        let unitTitle = visualUtils.getUnitType(axis) || "No unit";
        switch (axisStyle) {
            case "showUnitOnly": {
                return unitTitle;
            }
            case "showTitleOnly": {
                return title;
            }
            case "showBoth": {
                return `${title} (${unitTitle})`;
            }
        }
    }

    export const DimmedOpacity: number = 0.4;
    export const DefaultOpacity: number = 1.0;

    export function getFillOpacity(selected: boolean, highlight: boolean, hasSelection: boolean, hasPartialHighlights: boolean): number {
        if ((hasPartialHighlights && !highlight) || (hasSelection && !selected)) {
            return DimmedOpacity;
        }

        return DefaultOpacity;
    }

    const CategoryMinHeight: number = 16;
    const CategoryMaxHeight: number = 130;
    const CategoryContinuousMinHeight: number = 1;

    export function calculateBarHeight(
        visualDataPoints: VisualDataPoint[],
        visualSize: ISize,
        categories: string[],
        categoryInnerPadding: number,
        yScale: any,
        axisType: string): number {

        let currentBarHeight = visualSize.height / categories.length;
        let barHeight: number = 0;

        if (axisType === "categorical") {
            let innerPadding: number = categoryInnerPadding / 100;
            barHeight = d3.min([CategoryMaxHeight, d3.max([CategoryMinHeight, currentBarHeight])]) * (1 - innerPadding);
        } else {
            let dataPoints = [...visualDataPoints];

            let dataPointsCount: number = dataPoints.length;

            if (dataPointsCount < 4) {
                let devider: number = 3.75;
                barHeight = visualSize.width / devider;
            } else {
                let devider: number = 3.75 + 1.25 * (dataPointsCount - 3); 
                barHeight = visualSize.width / devider;
            }
        }

        return barHeight;
    }

    export function getLabelsMaxWidth(group: d3.selection.Group): number {
        const widths: Array<number> = [];

        group.forEach((item: any) => {
            let dimension: ClientRect = item.getBoundingClientRect();
            widths.push(d3.max([dimension.width, dimension.height]));
        });

        if (group.length === 0) {
            widths.push(0);
        }

        return d3.max(widths);
    }

    export function getLabelsMaxHeight(group: d3.selection.Group): number {
        const heights: Array<number> = [];

        group.forEach((item: any) => {
            let dimension: ClientRect = item.getBoundingClientRect();
            heights.push(dimension.height);
        });

        if (group.length === 0) {
            heights.push(0);
        }

        return d3.max(heights);
    }

    export function GetYAxisTitleHeight(valueSettings: valueAxisSettings): number {

        let textPropertiesForHeight: TextProperties = {
            fontFamily: valueSettings.titleFontFamily,
            fontSize: valueSettings.titleFontSize.toString()
        };

        return TextMeasurementService.estimateSvgTextHeight(textPropertiesForHeight);
    }

    export function isSelected(selected: boolean, highlight: boolean, hasSelection: boolean, hasPartialHighlights: boolean): boolean {
        return !(hasPartialHighlights && !highlight || hasSelection && !selected);
    }

    export function GetXAxisTitleHeight(categorySettings: categoryAxisSettings): number {

        let textPropertiesForHeight: TextProperties = {
            fontFamily: categorySettings.titleFontFamily,
            fontSize: categorySettings.titleFontSize.toString()
        };

        return TextMeasurementService.estimateSvgTextHeight(textPropertiesForHeight);
    }

    export function compareObjects(obj1: any[], obj2: any[], property: string): boolean {
        let isEqual: boolean = false;

        if (obj1.length > 0 && obj2.length > 0 && obj1.length === obj2.length) {
            isEqual = true;
            obj1.forEach((o1, i) => {
                obj2.forEach((o2, j) => {
                    if (i === j) {
                        isEqual = isEqual && o1[property] === o2[property];
                    }
                });
            });
        } else if (obj1.length === 0 && obj2.length === 0) {
            isEqual = true;
        }

        return isEqual;
    }
}
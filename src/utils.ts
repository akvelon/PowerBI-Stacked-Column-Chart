module powerbi.extensibility.visual.visualUtils {
    import IAxisProperties = powerbi.extensibility.utils.chart.axis.IAxisProperties;
    import TextMeasurmentService = powerbi.extensibility.utils.formatting.textMeasurementService;
    import TextProperties = powerbi.extensibility.utils.formatting.TextProperties;
    import IValueFormatter = powerbi.extensibility.utils.formatting.IValueFormatter;
    import TextMeasurementService = powerbi.extensibility.utils.formatting.textMeasurementService;

    const DisplayUnitValue: number = 1;

    export function calculateBarCoordianates(data: VisualData, settings: VisualSettings, dataPointThickness: number): void {
        const categoryAxisIsContinuous: boolean = data.axes.xIsScalar && settings.categoryAxis.axisType !== "categorical";

        const categoryAxisStartValue: number = categoryAxisIsContinuous && settings.categoryAxis.start ? settings.categoryAxis.start : 0;
        const categoryAxisEndValue: number = categoryAxisIsContinuous && settings.categoryAxis.end ? settings.categoryAxis.end : Number.MAX_VALUE;

        const thickness: number = dataPointThickness;

        data.dataPoints.forEach(point => {
            if (categoryAxisIsContinuous){
                const categoryvalueIsInRange: boolean = point.category >= categoryAxisStartValue && point.category <= categoryAxisEndValue;
                if (!categoryvalueIsInRange){
                    setZeroCoordinatesForPoint(point);
                    return;
                }
            }

            let x: number = data.axes.x.scale(point.category);
            if (categoryAxisIsContinuous) {
                x -= thickness / 2;
            }

            const fromValue: number = point.shiftValue;
            let fromCoordinate: number = data.axes.y.scale(fromValue);
            fromCoordinate = Math.min(fromCoordinate, data.size.height);
            const toValue = fromValue + point.valueForHeight;
            let toCoordinate: number = data.axes.y.scale(toValue);
            toCoordinate = Math.max(toCoordinate, 0);

            if ( toCoordinate >= fromCoordinate ){
                setZeroCoordinatesForPoint(point);
                return;
            }

            let volume: number = fromCoordinate - toCoordinate;
            if (volume < 1 && volume !== 0){
                volume = 1;
            }

            point.barCoordinates = {
                height: volume,
                width: thickness,
                x,
                y: toCoordinate
            };
        });

        if (data.axes.xIsScalar && settings.categoryAxis.axisType !== "categorical") {
            recalculateThicknessForContinuous(data, thickness);
        }
    }

    function setZeroCoordinatesForPoint(point: VisualDataPoint): void {
        point.barCoordinates = {height: 0, width: 0, x: 0, y: 0};
    }

    export function recalculateThicknessForContinuous(data: VisualData, dataPointThickness: number) {
        let minWidth: number = 1.5,
            minDistance: number = Number.MAX_VALUE;

        let dataPoints: VisualDataPoint[] = data.dataPoints.sort((a, b) => {
            return a.barCoordinates.x - b.barCoordinates.x;
        });

        let firstDataPoint: VisualDataPoint = dataPoints[0];

        for (let i = 1; i < dataPoints.length; ++i) {
            let distance: number = dataPoints[i].barCoordinates.x - firstDataPoint.barCoordinates.x;

            minDistance = distance < minDistance ? distance : minDistance;
            firstDataPoint = dataPoints[i];
        }

        if (minDistance < minWidth) {
            
        } else if (minWidth < minDistance && minDistance < dataPointThickness) {
            minWidth = minDistance;
        } else {
            minWidth = dataPointThickness;
        }

        if (dataPointThickness && dataPointThickness !== minWidth) {
            dataPoints.forEach(x => {
                x.barCoordinates.width = x.barCoordinates.width ? minWidth : 0;
                x.barCoordinates.x = x.barCoordinates.x + dataPointThickness / 2;
            });
        }
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

    export function calculateDataPointThickness( // calculateBarHeight
        visualDataPoints: VisualDataPoint[],
        visualSize: ISize,
        categories: string[],
        categoryInnerPadding: number,
        yScale: any,
        settings: VisualSettings): number {

        let currentBarHeight = visualSize.height / categories.length;
        let barHeight: number = 0;

        if (settings.categoryAxis.axisType === "categorical") {
            let innerPadding: number = categoryInnerPadding / 100;
            barHeight = d3.min([CategoryMaxHeight, d3.max([CategoryMinHeight, currentBarHeight])]) * (1 - innerPadding);
        } else {
            let dataPoints = [...visualDataPoints];

            let start = settings.categoryAxis.start,
                end = settings.categoryAxis.end;

            if (start != null || end != null) {
                dataPoints = dataPoints.filter(x => start != null ? x.value >= start : true 
                                                &&  end != null ? x.value <= end : true)
            }

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
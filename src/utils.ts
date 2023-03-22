module powerbi.extensibility.visual.visualUtils {
    import IAxisProperties = powerbi.extensibility.utils.chart.axis.IAxisProperties;
    import TextMeasurmentService = powerbi.extensibility.utils.formatting.textMeasurementService;
    import TextProperties = powerbi.extensibility.utils.formatting.TextProperties;
    import IValueFormatter = powerbi.extensibility.utils.formatting.IValueFormatter;
    import TextMeasurementService = powerbi.extensibility.utils.formatting.textMeasurementService;
    import PixelConverter = powerbi.extensibility.utils.type.PixelConverter;
    import axis = powerbi.extensibility.utils.chart.axis;
    import valueType = powerbi.extensibility.utils.type.ValueType;

    const DisplayUnitValue: number = 1;

    export function calculateBarCoordianatesByData(data: VisualData, settings: VisualSettings, barHeight: number, isSmallMultiple: boolean = false): void {
        let dataPoints: VisualDataPoint[] = data.dataPoints;
        let axes: IAxes = data.axes;

        this.calculateBarCoordianates(dataPoints, axes, settings, barHeight, isSmallMultiple);
    }

    export function calculateBarCoordianates(dataPoints: VisualDataPoint[], axes: IAxes, settings: VisualSettings, dataPointThickness: number, isSmallMultiple: boolean = false): void {
        const categoryAxisIsContinuous: boolean = axes.xIsScalar && settings.categoryAxis.axisType !== "categorical";

        const skipCategoryStartEnd: boolean = isSmallMultiple && settings.categoryAxis.rangeType !== AxisRangeType.Custom,
            skipValueStartEnd: boolean = isSmallMultiple && settings.valueAxis.rangeType !== AxisRangeType.Custom;

        const categoryAxisStartValue: number = categoryAxisIsContinuous && settings.categoryAxis.start ? settings.categoryAxis.start : -Number.MAX_VALUE;
        const categoryAxisEndValue: number = categoryAxisIsContinuous && settings.categoryAxis.end ? settings.categoryAxis.end : Number.MAX_VALUE;

        const thickness: number = dataPointThickness;

        dataPoints.forEach(point => {
            let width = 0;
            if (!axes.xIsScalar || !categoryAxisIsContinuous) {
                width = axes.x.scale.rangeBand();
            } else {
                width = dataPoints.length > 2 ? dataPointThickness * 0.8 : dataPointThickness / 2 * 0.8;
            }

            if (categoryAxisIsContinuous){
                const categoryvalueIsInRange: boolean = point.category >= categoryAxisStartValue && point.category <= categoryAxisEndValue;
                if (!categoryvalueIsInRange){
                    setZeroCoordinatesForPoint(point);
                    return;
                }
            }

            let x: number = axes.x.scale(point.category);
            if (point.shiftValue > axes.y.dataDomain[1]) {
                setZeroCoordinatesForPoint(point);
                return;
            }

            const fromValue: number = Math.max(point.shiftValue, axes.y.dataDomain[0]);
            const fromCoordinate: number = axes.y.scale(fromValue);

            if (fromValue + point.valueForHeight < axes.y.dataDomain[0]) {
                setZeroCoordinatesForPoint(point);
                return;
            }

            const toValue = Math.min(point.shiftValue + point.valueForHeight, axes.y.dataDomain[1]);
            const toCoordinate: number = axes.y.scale(toValue);

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
                width: width,
                x,
                y: toCoordinate
            };
        });

        if (axes.xIsScalar && settings.categoryAxis.axisType !== "categorical") {
            recalculateThicknessForContinuous(dataPoints, skipCategoryStartEnd, settings.categoryAxis, thickness);
        }
    }

    function setZeroCoordinatesForPoint(point: VisualDataPoint): void {
        point.barCoordinates = {height: 0, width: 0, x: 0, y: 0};
    }

    export function recalculateThicknessForContinuous(dataPoints: VisualDataPoint[], skipCategoryStartEnd: boolean, categorySettings: categoryAxisSettings, startThickness: number) {
        let minWidth: number = 1.5,
            minDistance: number = Number.MAX_VALUE;

        let start = skipCategoryStartEnd ? null : categorySettings.start,
            end = skipCategoryStartEnd ? null : categorySettings.end;

        let sortedDataPoints: VisualDataPoint[] = dataPoints.sort((a, b) => {
            return a.barCoordinates.x - b.barCoordinates.x;
        });

        let sortedBarCoordinates: number[] = sortedDataPoints.map(d => d.barCoordinates.x).filter((v, i, a) => a.indexOf(v) === i);

        let firstCoodinate: number = sortedBarCoordinates[0];

        for (let i = 1; i < sortedBarCoordinates.length; ++i) {

            let distance: number = sortedBarCoordinates[i] - firstCoodinate;

            minDistance = distance < minDistance ? distance : minDistance;
            firstCoodinate = sortedBarCoordinates[i];
        }

        if (minDistance < minWidth) {
            
        } else if (minWidth < minDistance) {
            minWidth = minDistance;
        }

        sortedDataPoints.forEach(d => {
            let width: number = 0;
            if (startThickness > minWidth) {
                let padding: number = minWidth / 100 * 20;
                width = minWidth - padding;
            } else {
                width = d.barCoordinates.width;
            }

            width = start != null && start > d.category || width < 0 ? 0 : width;
            width = end != null && end <= d.category ? 0 : width;

            d.barCoordinates.width = width;

            d.barCoordinates.x = d.barCoordinates.x - d.barCoordinates.width / 2;
        });
    }

    export function calculateLabelCoordinates(data: VisualData,
                                            settings: categoryLabelsSettings,
                                            metadata: VisualMeasureMetadata,
                                            chartHeight: number,
                                            isLegendRendered: boolean,
                                            dataPoints: VisualDataPoint[] = null) {
        if (!settings.show) {
            return;
        }

        let dataPointsArray: VisualDataPoint[] = dataPoints || data.dataPoints;

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

    const CategoryMinWidth: number = 1;
    const CategoryMaxWidth: number = 450;
    const CategoryContinuousMinHeight: number = 1;

    export function calculateDataPointThickness( // calculateBarHeight
        visualDataPoints: VisualDataPoint[],
        visualSize: ISize,
        categoriesCount: number,
        categoryInnerPadding: number,
        settings: VisualSettings,
        isCategorical: boolean = false,
        isSmallMultiple: boolean = false): number {

        let currentThickness = visualSize.width / categoriesCount;
        let thickness: number = 0;

        if (isCategorical || settings.categoryAxis.axisType === "categorical") {
            let innerPadding: number = categoryInnerPadding / 100;

            thickness = d3.min([CategoryMaxWidth, d3.max([CategoryMinWidth, currentThickness])]) * (1 - innerPadding);

        } else {
            let dataPoints = [...visualDataPoints];

            const skipStartEnd: boolean = isSmallMultiple && settings.categoryAxis.rangeType !== AxisRangeType.Custom;

            let start = skipStartEnd ? null : settings.categoryAxis.start,
                end = skipStartEnd ? null : settings.categoryAxis.end;

            if (start != null || end != null) {
                dataPoints = dataPoints.filter(x => start != null ? x.value >= start : true 
                                                &&  end != null ? x.value <= end : true)
            }

            let dataPointsCount: number = dataPoints.map(x => x.category).filter((v, i, a) => a.indexOf(v) === i).length;

            if (dataPointsCount < 4) {
                let devider: number = 3.75;
                thickness = visualSize.width / devider;
            } else {
                let devider: number = 3.75 + 1.25 * (dataPointsCount - 3); 
                thickness = visualSize.width / devider;
            }
        }

        return thickness;
    }

    export function getLabelsMaxWidth(group: d3Selection.Group): number {
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

    export function getLabelsMaxHeight(group: d3Selection.Group): number {
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

    export function smallMultipleLabelRotationIsNeeded(
        xAxisSvgGroup: d3Selection<any>,
        barHeight: number,
        categoryAxisSettings: categoryAxisSettings,
        maxLabelHeight: number
    ): boolean {
        const rangeBand = barHeight;

        let maxLabelWidth: number = 0;

        xAxisSvgGroup.selectAll('text').each(function(){
            const labelWidth: number = this.getBoundingClientRect().width;

            maxLabelWidth = Math.max(maxLabelWidth, labelWidth > maxLabelHeight ? maxLabelHeight : labelWidth);
        });

        return maxLabelWidth > rangeBand;
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

    export function isScalar(column: DataViewMetadataColumn) {
        const categoryType: valueType = axis.getCategoryValueType(column);
        let isOrdinal: boolean = axis.isOrdinal(categoryType);

        return !isOrdinal;
    }

    export function categoryIsScalar(metadata: VisualMeasureMetadata): boolean {
        const categoryType: valueType = axis.getCategoryValueType(metadata.cols.category);
        let isOrdinal: boolean = axis.isOrdinal(categoryType);

        return !isOrdinal;
    }
}
'use strict';

import {Selection} from 'd3-selection';
import {
    AxisRangeType,
    categoryAxisSettings,
    categoryLabelsSettings,
    LabelOrientation,
    valueAxisSettings,
    VisualSettings,
} from './settings';
import {IAxes, ISize, VisualData, VisualDataPoint, VisualMeasureMetadata} from './visualInterfaces';

export type d3Selection<T> = Selection<any, T, any, any>;
export type d3Update<T> = Selection<any, T, any, any>;
export type d3Group<T> = Selection<any, T, any, any>;

import powerbiApi from 'powerbi-visuals-api';
import DataViewMetadataColumn = powerbiApi.DataViewMetadataColumn;
import DataView = powerbiApi.DataView;

import {axis} from 'powerbi-visuals-utils-chartutils';

import {
    textMeasurementService as TextMeasurementService,
    interfaces,
    valueFormatter as ValueFormatter,
} from 'powerbi-visuals-utils-formattingutils';
import TextProperties = interfaces.TextProperties;
import IValueFormatter = ValueFormatter.IValueFormatter;

// import { valueType } from "powerbi-visuals-utils-typeutils";

import * as visualUtils from './utils';

import {Field} from './dataViewConverter';
import {IAxisProperties} from 'powerbi-visuals-utils-chartutils/lib/axis/axisInterfaces';
import {max, min} from 'd3-array';
import {getTextProperties, getTextPropertiesForHeightCalculation, getValueForFormatter} from './utils/formattingUtils';
import * as formattingUtils from './utils/formattingUtils';
import {DataLabelHelper} from './utils/dataLabelHelper';

const DisplayUnitValue: number = 1;


export function calculateBarCoordianatesByData(data: VisualData, settings: VisualSettings, barHeight: number, isSmallMultiple: boolean = false): void {
    const dataPoints: VisualDataPoint[] = data.dataPoints;
    const axes: IAxes = data.axes;

    this.calculateBarCoordianates(dataPoints, axes, settings, barHeight, isSmallMultiple);
}

export function calculateBarCoordianates(dataPoints: VisualDataPoint[], axes: IAxes, settings: VisualSettings, dataPointThickness: number, isSmallMultiple: boolean = false): void {
    const categoryAxisIsContinuous: boolean = axes.xIsScalar && settings.categoryAxis.axisType !== 'categorical';

    const skipCategoryStartEnd: boolean = isSmallMultiple && settings.categoryAxis.rangeType !== AxisRangeType.Custom;

    const categoryAxisStartValue: number = categoryAxisIsContinuous && settings.categoryAxis.start ? settings.categoryAxis.start : -Number.MAX_VALUE;
    const categoryAxisEndValue: number = categoryAxisIsContinuous && settings.categoryAxis.end ? settings.categoryAxis.end : Number.MAX_VALUE;

    const thickness: number = dataPointThickness;

    dataPoints.forEach(point => {
        let width = 0;
        if (!axes.xIsScalar || !categoryAxisIsContinuous) {
            width = axes.x.scale.bandwidth();
        } else {
            width = dataPoints.length > 2 ? dataPointThickness * 0.8 : dataPointThickness / 2 * 0.8;
        }

        if (categoryAxisIsContinuous) {
            const categoryvalueIsInRange: boolean = point.category >= categoryAxisStartValue && point.category <= categoryAxisEndValue;
            if (!categoryvalueIsInRange) {
                setZeroCoordinatesForPoint(point);
                return;
            }
        }

        const x: number = axes.x.scale(point.category);
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

        if (toCoordinate >= fromCoordinate) {
            setZeroCoordinatesForPoint(point);
            return;
        }

        let volume: number = fromCoordinate - toCoordinate;
        if (volume < 1 && volume !== 0) {
            volume = 1;
        }

        point.barCoordinates = {
            height: volume,
            width: width,
            x,
            y: toCoordinate,
        };
    });

    if (axes.xIsScalar && settings.categoryAxis.axisType !== 'categorical') {
        recalculateThicknessForContinuous(dataPoints, skipCategoryStartEnd, settings.categoryAxis, thickness);
    }
}

function setZeroCoordinatesForPoint(point: VisualDataPoint): void {
    point.barCoordinates = {height: 0, width: 0, x: 0, y: 0};
}

export function recalculateThicknessForContinuous(dataPoints: VisualDataPoint[], skipCategoryStartEnd: boolean, categorySettings: categoryAxisSettings, startThickness: number) {
    let minWidth: number = 1.5,
        minDistance: number = Number.MAX_VALUE;

    const start = skipCategoryStartEnd ? null : categorySettings.start,
        end = skipCategoryStartEnd ? null : categorySettings.end;

    const sortedDataPoints: VisualDataPoint[] = dataPoints.sort((a, b) => {
        return a.barCoordinates.x - b.barCoordinates.x;
    });

    const sortedBarCoordinates: number[] = sortedDataPoints.map(d => d.barCoordinates.x).filter((v, i, a) => a.indexOf(v) === i);

    let firstCoodinate: number = sortedBarCoordinates[0];

    for (let i = 1; i < sortedBarCoordinates.length; ++i) {

        const distance: number = sortedBarCoordinates[i] - firstCoodinate;

        minDistance = distance < minDistance ? distance : minDistance;
        firstCoodinate = sortedBarCoordinates[i];
    }

    if (minWidth < minDistance) {
        minWidth = minDistance;
    }

    sortedDataPoints.forEach(d => {
        let width: number = 0;
        if (startThickness > minWidth) {
            const padding: number = minWidth / 100 * 20;
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

    const dataPointsArray: VisualDataPoint[] = dataPoints || data.dataPoints;

    const dataLabelFormatter: IValueFormatter = formattingUtils.createFormatter(settings.displayUnits,
        settings.precision,
        metadata.cols.value,
        getValueForFormatter(data));

    const textPropertiesForWidth: TextProperties = getTextProperties(settings);
    const textPropertiesForHeight: TextProperties = getTextPropertiesForHeightCalculation(settings);

    dataPointsArray.forEach(dataPoint => {
        const formattedText: string = dataLabelFormatter.format(dataPoint.value);
        textPropertiesForHeight.text = formattedText;

        const isHorizontal: boolean = settings.orientation === LabelOrientation.Horizontal;

        const textHeight: number = isHorizontal ?
            TextMeasurementService.estimateSvgTextHeight(textPropertiesForWidth)
            : TextMeasurementService.measureSvgTextWidth(textPropertiesForWidth, formattedText);

        const textWidth: number = isHorizontal ?
            TextMeasurementService.measureSvgTextWidth(textPropertiesForWidth, formattedText)
            : TextMeasurementService.estimateSvgTextHeight(textPropertiesForWidth);

        const barWidth: number = dataPoint.barCoordinates.width;

        if (settings.overflowText || textWidth +
            (settings.showBackground ? DataLabelHelper.labelBackgroundHeightPadding : 0) < barWidth) {

            const dx: number = dataPoint.barCoordinates.x + dataPoint.barCoordinates.width / 2 + (isHorizontal ? -(textWidth) / 2 : (textWidth) / 3),
                dy: number = DataLabelHelper.calculatePositionShift(settings, textHeight, dataPoint, chartHeight, isLegendRendered);

            if (dy !== null) {
                dataPoint.labelCoordinates = {
                    x: dx,
                    y: dy,
                    width: textWidth,
                    height: textHeight,
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

    for (const columnName in columns) {
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
        case 'solid':
            strokeDasharray = 'none';
            break;
        case 'dashed':
            strokeDasharray = '7, 5';
            break;
        case 'dotted':
            strokeDasharray = '2, 2';
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
    const unitTitle = visualUtils.getUnitType(axis) || 'No unit';
    switch (axisStyle) {
        case 'showUnitOnly': {
            return unitTitle;
        }
        case 'showTitleOnly': {
            return title;
        }
        case 'showBoth': {
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

export function calculateDataPointThickness( // calculateBarHeight
    visualDataPoints: VisualDataPoint[],
    visualSize: ISize,
    categoriesCount: number,
    categoryInnerPadding: number,
    settings: VisualSettings,
    isCategorical: boolean = false,
    isSmallMultiple: boolean = false): number {

    const currentThickness = visualSize.width / categoriesCount;
    let thickness: number = 0;

    if (isCategorical || settings.categoryAxis.axisType === 'categorical') {
        const innerPadding: number = categoryInnerPadding / 100;

        thickness = min([CategoryMaxWidth, max([CategoryMinWidth, currentThickness])]) * (1 - innerPadding);

    } else {
        let dataPoints = [...visualDataPoints];

        const skipStartEnd: boolean = isSmallMultiple && settings.categoryAxis.rangeType !== AxisRangeType.Custom;

        const start = skipStartEnd ? null : settings.categoryAxis.start,
            end = skipStartEnd ? null : settings.categoryAxis.end;

        if (start != null || end != null) {
            dataPoints = dataPoints.filter(x => start != null ? x.value >= start : true
            && end != null ? x.value <= end : true);
        }

        const dataPointsCount: number = dataPoints.map(x => x.category).filter((v, i, a) => a.indexOf(v) === i).length;

        if (dataPointsCount < 4) {
            const devider: number = 3.75;
            thickness = visualSize.width / devider;
        } else {
            const devider: number = 3.75 + 1.25 * (dataPointsCount - 3);
            thickness = visualSize.width / devider;
        }
    }

    return thickness;
}

export function getLabelsMaxWidth(group: d3Group<any>): number {
    const widths: Array<number> = [];

    group.nodes().forEach((item: any) => {
        const dimension: ClientRect = item.getBoundingClientRect();
        widths.push(max([dimension.width, dimension.height]));
    });

    if (!group || group.size() === 0) {
        widths.push(0);
    }

    return max(widths);
}

export function getLabelsMaxHeight(group: d3Group<any>): number {
    const heights: Array<number> = [];

    group.nodes().forEach((item: any) => {
        const dimension: ClientRect = item.getBoundingClientRect();
        heights.push(dimension.height);
    });

    if (!group || group.size() === 0) {
        heights.push(0);
    }

    return max(heights);
}

export function GetYAxisTitleHeight(valueSettings: valueAxisSettings): number {

    const textPropertiesForHeight: TextProperties = {
        fontFamily: valueSettings.titleFontFamily,
        fontSize: valueSettings.titleFontSize.toString(),
    };

    return TextMeasurementService.estimateSvgTextHeight(textPropertiesForHeight);
}

export function isSelected(selected: boolean, highlight: boolean, hasSelection: boolean, hasPartialHighlights: boolean): boolean {
    return !(hasPartialHighlights && !highlight || hasSelection && !selected);
}

export function GetXAxisTitleHeight(categorySettings: categoryAxisSettings): number {

    const textPropertiesForHeight: TextProperties = {
        fontFamily: categorySettings.titleFontFamily,
        fontSize: categorySettings.titleFontSize.toString(),
    };

    return TextMeasurementService.estimateSvgTextHeight(textPropertiesForHeight);
}

export function smallMultipleLabelRotationIsNeeded(
    xAxisSvgGroup: d3Selection<any>,
    barHeight: number,
    categoryAxisSettings: categoryAxisSettings,
    maxLabelHeight: number,
): boolean {
    const rangeBand = barHeight;

    let maxLabelWidth: number = 0;

    xAxisSvgGroup.selectAll<SVGTextElement, undefined>('text').nodes().forEach(function (textNode) {
        const labelWidth: number = textNode.getBoundingClientRect().width;

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
    const categoryType = axis.getCategoryValueType(column);
    const isOrdinal: boolean = axis.isOrdinal(categoryType);

    return !isOrdinal;
}

export function categoryIsScalar(metadata: VisualMeasureMetadata): boolean {
    const categoryType = axis.getCategoryValueType(metadata.cols.category);
    const isOrdinal: boolean = axis.isOrdinal(categoryType);

    return !isOrdinal;
}

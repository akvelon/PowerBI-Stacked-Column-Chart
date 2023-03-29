"use strict";

import { axisLeft, axisBottom, Axis, axisRight, axisTop } from "d3-axis";
import { ScaleLinear } from "d3-scale";
import { axisScale } from "powerbi-visuals-utils-chartutils";
import {
  createFormatter,
  createScale,
  getCategoryValueType,
  getMinTickValueInterval,
  getRecommendedTickValues,
  isLogScalePossible,
  powerOfTen,
} from "powerbi-visuals-utils-chartutils/lib/axis/axis";

import {
  AxisOrientation,
  CreateAxisOptions,
  CreateScaleResult,
  IAxisProperties,
} from "powerbi-visuals-utils-chartutils/lib/axis/axisInterfaces";
import { IValueFormatter } from "powerbi-visuals-utils-formattingutils/lib/src/valueFormatter";

import { valueType } from "powerbi-visuals-utils-typeutils";
import { HorizontalPosition, VerticalPosition, VisualSettings } from "../../settings";
import ValueType = valueType.ValueType;

export const getXAxisMaxWidth = (visualWidth: number, settings: VisualSettings) =>
  (visualWidth / 100) * settings.categoryAxis.maximumSize;

const TickLabelPadding: number = 2;

/**
 * Default ranges are for when we have a field chosen for the axis,
 * but no values are returned by the query.
 */
export const emptyDomain = [0, 0];

export const stackedAxisPadding = 5;
const ScalarTickLabelPadding = 3;

export interface CreateAxisOptionsExtended extends CreateAxisOptions {
  orientation: AxisOrientation;
}

/**
 * Copy of function from "powerbi-visuals-utils-chartutils" due to original function doesn't allow to create right axis
 * Create a D3 axis including scale. Can be vertical or horizontal, and either datetime, numeric, or text.
 * @param options The properties used to create the axis.
 */
// eslint-disable-next-line max-lines-per-function
export function createAxis(
  options: CreateAxisOptionsExtended
): IAxisProperties {
  const pixelSpan = options.pixelSpan,
    dataDomain = options.dataDomain,
    metaDataColumn = options.metaDataColumn,
    formatString = options.formatString,
    outerPadding = options.outerPadding || 0,
    isCategoryAxis = !!options.isCategoryAxis,
    isScalar = !!options.isScalar,
    isVertical = !!options.isVertical,
    useTickIntervalForDisplayUnits = !!options.useTickIntervalForDisplayUnits, // DEPRECATE: same meaning as isScalar?
    getValueFn = options.getValueFn,
    axisDisplayUnits = options.axisDisplayUnits,
    axisPrecision = options.axisPrecision,
    is100Pct = !!options.is100Pct,
    dataType = getCategoryValueType(metaDataColumn, isScalar),
    orientation: AxisOrientation = options.orientation;

  let categoryThickness = options.categoryThickness;
  // Create the Scale
  const scaleResult: CreateScaleResult = createScale(options);
  const scale = scaleResult.scale;
  const bestTickCount = scaleResult.bestTickCount;
  const scaleDomain = scale.domain();
  const isLogScaleAllowed = isLogScalePossible(dataDomain, dataType);

  // fix categoryThickness if scalar and the domain was adjusted when making the scale "nice"
  if (categoryThickness && isScalar && dataDomain && dataDomain.length === 2) {
    const oldSpan = dataDomain[1] - dataDomain[0];
    const newSpan = scaleDomain[1] - scaleDomain[0];
    if (oldSpan > 0 && newSpan > 0) {
      categoryThickness = (categoryThickness * oldSpan) / newSpan;
    }
  }

  // Prepare Tick Values for formatting
  let tickValues: any[];
  if (isScalar && bestTickCount === 1 && !arrayIsEmpty(dataDomain)) {
    tickValues = [dataDomain[0]];
  } else {
    const minTickInterval = isScalar
      ? getMinTickValueInterval(formatString, dataType, is100Pct)
      : undefined;
    tickValues = getRecommendedTickValues(
      bestTickCount,
      scale,
      dataType,
      isScalar,
      minTickInterval
    );
  }

  if (
    options.scaleType &&
    options.scaleType === axisScale.log &&
    isLogScaleAllowed
  ) {
    tickValues = tickValues.filter((d) => {
      return powerOfTen(d);
    });
  }

  const formatter = createFormatter(
    scaleDomain,
    dataDomain,
    dataType,
    isScalar,
    formatString,
    bestTickCount,
    tickValues,
    getValueFn,
    useTickIntervalForDisplayUnits,
    axisDisplayUnits,
    axisPrecision
  );

  let axisFunction;
  switch (orientation) {
    case AxisOrientation.left:
      axisFunction = axisLeft;
      break;
    case AxisOrientation.right:
      axisFunction = axisRight;
      break;
    case AxisOrientation.bottom:
      axisFunction = axisBottom;
      break;
    case AxisOrientation.top:
      axisFunction = axisTop;
      break;
    default:
      axisFunction = isVertical ? axisLeft : axisBottom;
  }

  const axis = axisFunction(scale)
    .tickSize(6)
    .ticks(bestTickCount)
    .tickValues(tickValues);

  let formattedTickValues = [];
  if (metaDataColumn)
    formattedTickValues = formatAxisTickValues(
      axis,
      tickValues,
      formatter,
      <any>dataType,
      <any>getValueFn
    );

  let xLabelMaxWidth;
  // Use category layout of labels if specified, otherwise use scalar layout of labels
  if (!isScalar && categoryThickness) {
    xLabelMaxWidth = Math.max(1, categoryThickness - TickLabelPadding * 2);
  } else {
    // When there are 0 or 1 ticks, then xLabelMaxWidth = pixelSpan
    xLabelMaxWidth =
      tickValues.length > 1
        ? getScalarLabelMaxWidth(scale, tickValues)
        : pixelSpan;
    xLabelMaxWidth = xLabelMaxWidth - ScalarTickLabelPadding * 2;
  }

  return {
    scale: scale,
    axis: axis,
    formatter: formatter,
    values: formattedTickValues,
    axisType: dataType,
    axisLabel: null,
    isCategoryAxis: isCategoryAxis,
    xLabelMaxWidth: xLabelMaxWidth,
    categoryThickness: categoryThickness,
    outerPadding: outerPadding,
    usingDefaultDomain: scaleResult.usingDefaultDomain,
    isLogScaleAllowed: isLogScaleAllowed,
    dataDomain: dataDomain,
  };
}

function arrayIsEmpty(array: any[]): boolean {
  return !(array && array.length);
}

/**
 * Format the linear tick labels or the category labels.
 */
function formatAxisTickValues(
  axis: Axis<any>,
  tickValues: any[],
  formatter: IValueFormatter,
  dataType: ValueType,
  getValueFn?: (index: number, dataType: ValueType) => any
) {
  let formattedTickValues = [];

  if (!getValueFn) getValueFn = (data) => data;

  if (formatter) {
    axis.tickFormat((d) => formatter.format(getValueFn(d, dataType)));
    formattedTickValues = tickValues.map((d) =>
      formatter.format(getValueFn(d, dataType))
    );
  } else {
    formattedTickValues = tickValues.map((d) => getValueFn(d, dataType));
  }

  return formattedTickValues;
}

function getScalarLabelMaxWidth(
  scale: ScaleLinear<any, any>,
  tickValues: number[]
): number {
  // find the distance between two ticks. scalar ticks can be anywhere, such as:
  // |---50----------100--------|
  if (scale && !arrayIsEmpty(tickValues)) {
    return Math.abs(scale(tickValues[1]) - scale(tickValues[0]));
  }

  return 1;
}

export function convertPositionToAxisOrientation(
    position: HorizontalPosition | VerticalPosition | string
  ): AxisOrientation {
    switch (position) {
      case HorizontalPosition.Left:
        return AxisOrientation.left;
  
      case HorizontalPosition.Right:
        return AxisOrientation.right;
  
      case VerticalPosition.Top:
        return AxisOrientation.top;
  
      case VerticalPosition.Bottom:
        return AxisOrientation.bottom;
    }
  }
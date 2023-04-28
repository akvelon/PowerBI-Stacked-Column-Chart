'use strict';

import {axisLeft, axisBottom, Axis, axisRight, axisTop} from 'd3-axis';
import {ScaleLinear} from 'd3-scale';
import {axisScale} from 'powerbi-visuals-utils-chartutils';
import {
    createFormatter,
    createScale, ensureValuesInRange,
    getCategoryValueType,
    getMinTickValueInterval,
    getRecommendedTickValuesForAnOrdinalRange,
    isDateTime,
    isLogScalePossible,
    isOrdinalScale,
    powerOfTen,
} from 'powerbi-visuals-utils-chartutils/lib/axis/axis';
import {
    AxisOrientation,
    CreateAxisOptions,
    CreateScaleResult,
    IAxisProperties,
} from 'powerbi-visuals-utils-chartutils/lib/axis/axisInterfaces';
import {DateTimeSequence} from 'powerbi-visuals-utils-formattingutils/lib/src/date/dateTimeSequence';
import {IValueFormatter} from 'powerbi-visuals-utils-formattingutils/lib/src/valueFormatter';
import {valueType} from 'powerbi-visuals-utils-typeutils';
import {range as d3range} from 'd3-array';
import ValueType = valueType.ValueType;

const TickLabelPadding: number = 2;
const ScalarTickLabelPadding = 3;
const MinTickCount = 2;

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
    options: CreateAxisOptionsExtended,
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
            minTickInterval,
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
        axisPrecision,
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
            <any>getValueFn,
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
    getValueFn?: (index: number, dataType: ValueType) => any,
) {
    let formattedTickValues = [];

    if (!getValueFn) getValueFn = (data) => data;

    if (formatter) {
        axis.tickFormat((d) => formatter.format(getValueFn(d, dataType)));
        formattedTickValues = tickValues.map((d) =>
            formatter.format(getValueFn(d, dataType)),
        );
    } else {
        formattedTickValues = tickValues.map((d) => getValueFn(d, dataType));
    }

    return formattedTickValues;
}

function getScalarLabelMaxWidth(
    scale: ScaleLinear<any, any>,
    tickValues: number[],
): number {
    // find the distance between two ticks. scalar ticks can be anywhere, such as:
    // |---50----------100--------|
    if (scale && !arrayIsEmpty(tickValues)) {
        return Math.abs(scale(tickValues[1]) - scale(tickValues[0]));
    }

    return 1;
}

export function getRecommendedTickValues(maxTicks, scale, axisType, isScalar, minTickInterval) {
    if (!isScalar || isOrdinalScale(scale)) {
        return getRecommendedTickValuesForAnOrdinalRange(maxTicks, scale.domain());
    } else if (isDateTime(axisType)) {
        return getRecommendedTickValuesForADateTimeRange(maxTicks, scale.domain());
    }

    return getRecommendedTickValuesForAQuantitativeRange(maxTicks, scale, minTickInterval);
}

function getRecommendedTickValuesForADateTimeRange(maxTicks, dataDomain) {
    let tickLabels = [];
    if (dataDomain[0] === 0 && dataDomain[1] === 0)
        return [];
    const dateTimeTickLabels = DateTimeSequence.CALCULATE(new Date(dataDomain[0]), new Date(dataDomain[1]), maxTicks).sequence;
    tickLabels = dateTimeTickLabels.map(d => d.getTime());
    tickLabels = ensureValuesInRange(tickLabels, dataDomain[0], dataDomain[1]);
    return tickLabels;
}

export function getRecommendedTickValuesForAQuantitativeRange(maxTicks, scale, minInterval) {
    let tickLabels = [];
    // if maxticks is zero return none
    if (maxTicks === 0)
        return tickLabels;
    const quantitiveScale = scale;
    if (quantitiveScale.ticks) {
        tickLabels = d3_scale_linearTicks(quantitiveScale.domain(), maxTicks);
        if (tickLabels.length > maxTicks && maxTicks > 1)
            tickLabels = d3_scale_linearTicks(quantitiveScale.domain(), maxTicks - 1);
        if (tickLabels.length < MinTickCount) {
            tickLabels = d3_scale_linearTicks(quantitiveScale.domain(), maxTicks + 1);
        }
        tickLabels = createTrueZeroTickLabel(tickLabels);
        if (minInterval && tickLabels.length > 1) {
            let tickInterval = tickLabels[1] - tickLabels[0];
            while (tickInterval > 0 && tickInterval < minInterval) {
                for (let i = 1; i < tickLabels.length; i++) {
                    tickLabels.splice(i, 1);
                }
                tickInterval = tickInterval * 2;
            }
            // keep at least two labels - the loop above may trim all but one if we have odd # of tick labels and dynamic range < minInterval
            if (tickLabels.length === 1) {
                tickLabels.push(tickLabels[0] + minInterval);
            }
        }

        return tickLabels;
    }

    return tickLabels;
}

/**
 * Round out very small zero tick values (e.g. -1e-33 becomes 0).
 *
 * @param ticks Array of numbers (from d3.scale.ticks([maxTicks])).
 * @param epsilon Max ratio of calculated tick interval which we will recognize as zero.
 *
 * e.g.
 *     ticks = [-2, -1, 1e-10, 3, 4]; epsilon = 1e-5;
 *     closeZero = 1e-5 * | 2 - 1 | = 1e-5
 *     // Tick values <= 1e-5 replaced with 0
 *     return [-2, -1, 0, 3, 4];
 */
function createTrueZeroTickLabel(ticks, epsilon = 1e-5) {
    if (!ticks || ticks.length < 2)
        return ticks;
    const closeZero = epsilon * Math.abs(ticks[1] - ticks[0]);
    return ticks.map((tick) => Math.abs(tick) <= closeZero ? 0 : tick);
}

/**
 * Copy of legacy d3 functions, slightly changed to compile.
 * New implementation of d3 scale.ticks() returns too much ticks, causing overlapping of labels.
 */
function d3_scale_linearTicks(domain, m) {
    const [rangeMin, rangeMax, step] = d3_scale_linearTickRange(domain, m);
    return d3range(rangeMin, rangeMax, step);
}

function d3_scale_linearTickRange(domain, m): any[] {
    if (m == null) m = 10;

    const extent = d3_scaleExtent(domain),
        span = extent[1] - extent[0];
    let step = Math.pow(10, Math.floor(Math.log(span / m) / Math.LN10));
    const err = m / span * step;

    // Filter ticks to get closer to the desired count.
    if (err <= .15) step *= 10;
    else if (err <= .35) step *= 5;
    else if (err <= .75) step *= 2;

    // Round start and stop values to step interval.
    extent[0] = Math.ceil(extent[0] / step) * step;
    extent[1] = Math.floor(extent[1] / step) * step + step * .5; // inclusive
    extent[2] = step;
    return extent;
}

function d3_scaleExtent(domain) {
    const start = domain[0], stop = domain[domain.length - 1];
    return start < stop ? [start, stop] : [stop, start];
}

"use strict";

import powerbiApi from "powerbi-visuals-api";
import IViewport = powerbiApi.IViewport;
import DataViewValueColumns = powerbiApi.DataViewValueColumns;
import DataViewMetadataColumn = powerbiApi.DataViewMetadataColumn;
import DataViewObject = powerbiApi.DataViewObject;
import DataViewCategoryColumn = powerbiApi.DataViewCategoryColumn;
import DataViewValueColumnGroup = powerbiApi.DataViewValueColumnGroup;
import DataView = powerbiApi.DataView;
import IVisualHost = powerbiApi.extensibility.visual.IVisualHost;

import * as d3 from 'd3-selection';

import { valueFormatter } from "powerbi-visuals-utils-formattingutils";

import { ColorHelper } from "powerbi-visuals-utils-colorutils";

import { legendInterfaces } from "powerbi-visuals-utils-chartutils";
import ILegend = legendInterfaces.ILegend;
import LegendPosition = legendInterfaces.LegendPosition;
import legendProps = legendInterfaces.legendProps;
import LegendDataPoint = legendInterfaces.LegendDataPoint;
import LegendIcon = legendInterfaces.MarkerShape;
import LegendData = legendInterfaces.LegendData;

import { legendSettings } from "./../settings";
import  * as visualUtils from "./../utils";
import  * as metadataUtils from "./../metadataUtils";
import { DataViewConverter } from "../dataViewConverter";

import { LegendProperties } from "../visualInterfaces";
import { positionChartArea } from "powerbi-visuals-utils-chartutils/lib/legend/legend";
import { update } from "powerbi-visuals-utils-chartutils/lib/legend/legendData";

export const MinAmountOfDataPointsInTheLegend: number = 1;
export const LegendLabelFontSizeDefault: number = 9;
export const DefaultFontFamily: string = "\"Segoe UI\", wf_segoe-ui_normal, helvetica, arial, sans-serif";
export const DefaultLegendTitleText: string = "Type";
export const DefaultLegendPosition: string = "Top";
const DefaultSelectionStateOfTheDataPoint: boolean = false;

export function buildLegendData(
    dataValues: DataViewValueColumns,
    host: IVisualHost,
    legendObjectProperties: legendSettings,
    dataValueSource: DataViewMetadataColumn,
    categories: DataViewCategoryColumn[],
    categoryIndex: number,
    hasDynamicSeries: boolean): LegendData {

    const colorHelper: ColorHelper = new ColorHelper(
        host.colorPalette,
        {objectName: "dataPoint", propertyName: "fill"});

    const legendItems: LegendDataPoint[] = [];
    const grouped: DataViewValueColumnGroup[] = dataValues.grouped();
    const formatString: string = valueFormatter.getFormatStringByColumn(<any>dataValueSource);

    if (hasDynamicSeries) {
        for (let i: number = 0, len: number = grouped.length; i < len; i++) {
            const grouping: DataViewValueColumnGroup = grouped[i];
            let color: string | null = null;
            const objects = grouping.objects;
            if (grouping.name) {
                color = colorHelper.getColorForSeriesValue(
                    objects,
                    grouping.name);
            }

            const selectionId = host.createSelectionIdBuilder()
                .withSeries(dataValues, grouping)
                .createSelectionId();

            legendItems.push({
                color: color || '',
                markerShape: LegendIcon.circle,
                label: valueFormatter.format(grouping.name, formatString),
                identity: selectionId,
                selected: DefaultSelectionStateOfTheDataPoint
            });
        }
    }

    let legendTitle: string = dataValues && dataValueSource
        ? dataValueSource.displayName
        : <string>legendObjectProperties.legendName;
    if (legendObjectProperties.legendName === undefined ||
        legendObjectProperties.legendName.toString().length === 0) {
        legendObjectProperties.legendName = legendTitle;
    }


    if (!legendTitle) {
        legendTitle = categories
            && categories[categoryIndex]
            && categories[categoryIndex].source
            && categories[categoryIndex].source.displayName
            ? categories[categoryIndex].source.displayName
            : <string>legendObjectProperties.legendName;
    }

    return {
        title: legendTitle,
        dataPoints: legendItems
    };
}

export function getSuitableLegendData( dataView: DataView, host: IVisualHost, legend: legendSettings): LegendData | undefined {
    let legendData: LegendData | undefined;
    const numberOfValueFields = visualUtils.getNumberOfValues(dataView);
    if (DataViewConverter.IsLegendFilled(dataView) && dataView.categorical?.values && dataView.categorical?.values?.source) {
        legendData = buildLegendData(
            dataView.categorical?.values,
            host,
            legend,
            dataView.categorical?.values?.source,
            dataView.categorical?.categories || [],
            <any>metadataUtils.getMetadata(
                dataView.categorical?.categories,
                dataView.categorical?.values?.grouped(),
                dataView.metadata.columns[0]).idx.category,
            !!dataView.categorical.values.source);
    } else if (numberOfValueFields > 1) {

        legendData = buildLegendDataForMultipleValues(host,
            dataView,
            numberOfValueFields);
    }
    return legendData;
}

export function getLegendColors(legendDataPoints: LegendDataPoint[]): Array<string> {
    const legendColors: string[] = [];

    legendDataPoints.forEach(legendDataPoint => legendColors.push(legendDataPoint.color));

    return legendColors;
}

export function buildLegendDataForMultipleValues(
    host: IVisualHost,
    dataView: DataView,
    numberOfValueFields: number): LegendData {

    let colorHelper: ColorHelper | null = new ColorHelper(
        host.colorPalette,
        {objectName: "dataPoint", propertyName: "fill"});

    const legendItems: LegendDataPoint[] = [];

    const values = dataView.categorical?.values;

    for (let i = 0; i < numberOfValueFields; i++) {
        const objects = values?.[i].source.objects;
        const color = colorHelper.getColorForMeasure(
            objects,
        i + "value");
        
        const builder = host.createSelectionIdBuilder();
        const queryName = values?.[i].source.queryName;
        if (queryName) {
            builder.withMeasure(queryName);
        }
        const selectionId = builder.createSelectionId();

        legendItems.push({
            color: color || '',
            markerShape: LegendIcon.circle,
            label: values?.[i].source.displayName || '',
            identity: selectionId,
            selected: DefaultSelectionStateOfTheDataPoint
        });
    }

    colorHelper = null;

    return {
        title: 'Values:',
        dataPoints: legendItems
    };
}

export function renderLegend(
    visualLegend: ILegend,
    svg: visualUtils.d3Selection<SVGElement>,
    viewport: IViewport,
    legendProperties: LegendProperties): void {
    const legendDataForRender: LegendData = {
        title: "",
        dataPoints: []
    };

    const legendObject: DataViewObject = legendProperties.legendObject;
    const legendData = legendProperties.data;

    legendDataForRender.labelColor = legendObject.legendNameColor as string;
    legendDataForRender.title = legendObject.titleText as string;

    const legend: ILegend = visualLegend;

    const fontFamily: string = legendObject.fontFamily.toString() || DefaultFontFamily;

    if (legendData) {
        legendDataForRender.dataPoints = legendData.dataPoints ? legendData.dataPoints : [];

        legendDataForRender.fontSize = legendObject.fontSize ? legendObject.fontSize as number : LegendLabelFontSizeDefault;

        // Important: This code is redefining props of chart legend util
        (legend as any).__proto__.constructor.DefaultTitleFontFamily = (legend as any).__proto__.constructor.DefaultFontFamily = fontFamily;

        legendDataForRender.grouped = !!legendData.grouped;
    }

    if (legendProperties) {
        update(legendDataForRender, legendObject);

        const position: string = legendProperties.legendObject[legendProps.position] as string;

        if (position) {
            legend.changeOrientation(LegendPosition[position]);
        }
    }
    else {
        legend.changeOrientation(LegendPosition.Top);
    }

    // Important: This code is overriding styles of chart legend util
    const legendGroup = d3.select('#legendGroup').node() as HTMLElement;
    legendGroup.style.fontFamily = fontFamily;

    legend.drawLegend(legendDataForRender, {
        height: viewport.height,
        width: viewport.width
    });


    positionChartArea(svg, legend);
}

export function getLegendProperties(
    legendSettings: legendSettings): DataViewObject {

    return {
        show: legendSettings.show,
        position: legendSettings.position,
        showTitle: legendSettings.showTitle,
        titleText: legendSettings.legendName,
        legendNameColor: legendSettings.legendNameColor,
        fontSize: legendSettings.fontSize,
        fontFamily: legendSettings.fontFamily,
    };
}

export function setLegendProperties(dataView: DataView, host: IVisualHost, settings: legendSettings): LegendProperties {
    const legendObject: DataViewObject = getLegendProperties(settings);
    const legendData = getSuitableLegendData(dataView, host, settings);
    const legendIsRendered = legendData === undefined ? false : legendData.dataPoints.length > 0;
    const legendColors = legendIsRendered && legendData ? getLegendColors(legendData.dataPoints) : [];

    return {
        legendObject: legendObject,
        data: legendData,
        colors: legendColors,
    }
}
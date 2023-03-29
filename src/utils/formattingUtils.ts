"use strict";

import powerbiApi from "powerbi-visuals-api";
import { categoryLabelsSettings } from "../settings";
import { VisualData } from "../visualInterfaces";
import DataViewMetadataColumn = powerbiApi.DataViewMetadataColumn;

import { interfaces, valueFormatter as ValueFormatter} from "powerbi-visuals-utils-formattingutils";
import TextProperties = interfaces.TextProperties;

import { pixelConverter as PixelConverter} from "powerbi-visuals-utils-typeutils";

import { dataLabelUtils } from "powerbi-visuals-utils-chartutils";


export function getFormatStringByColumn(column: DataViewMetadataColumn) {
    return !column.format && column.type.numeric ? "0.00" : ValueFormatter.getFormatStringByColumn(<any>column);
}

export function createFormatter(displayUnits: number, precision: number, column: DataViewMetadataColumn, value: number) {
    return ValueFormatter.create({
        value: displayUnits === 0 && value ? value : displayUnits,
        value2: 0,
        precision: precision,
        format: this.getFormatStringByColumn(column)
    });
}

export function getValueForFormatter(data: VisualData) {
    return data.axes.x.axis.tickValues()[1];
}

export function getTextProperties(settings: categoryLabelsSettings): TextProperties {
    const fontSizeInPx: string = PixelConverter.fromPoint(settings.fontSize);
    const fontFamily: string = settings.fontFamily ? settings.fontFamily : dataLabelUtils.LabelTextProperties.fontFamily;

    return {
        fontSize: fontSizeInPx.toString(),
        fontFamily: fontFamily
    };
}

export function getTextPropertiesForHeightCalculation(settings: categoryLabelsSettings): TextProperties  {
    const fontFamily: string = settings.fontFamily ? settings.fontFamily : dataLabelUtils.LabelTextProperties.fontFamily;

    return  {
        fontSize: settings.fontSize.toString(),
        fontFamily: fontFamily
    };
}
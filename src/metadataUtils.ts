"use strict";

import powerbiApi from "powerbi-visuals-api";
import { VisualMeasureMetadata } from "./visualInterfaces";

import DataViewMetadataColumn = powerbiApi.DataViewMetadataColumn;
import DataViewCategoryColumn = powerbiApi.DataViewCategoryColumn;
import DataViewValueColumnGroup = powerbiApi.DataViewValueColumnGroup;

import { dataRoleHelper } from "powerbi-visuals-utils-dataviewutils";
import getMeasureIndexOfRole = dataRoleHelper.getMeasureIndexOfRole;
import getCategoryIndexOfRole = dataRoleHelper.getCategoryIndexOfRole;

const ColumnCategory: string = "Axis";
const ColumnValue: string = "Value";
const ColumnGradient: string = "Gradient"; 
const ColumnColumnBy: string = 'ColumnBy';
const ColumnRowBy: string = 'RowBy';

export function getMetadata(
    categories: DataViewCategoryColumn[],
    grouped: DataViewValueColumnGroup[],
    source: DataViewMetadataColumn): VisualMeasureMetadata {

    let xAxisLabel: string = "";
    let yAxisLabel: string = "";
    const valueIndex: number = getMeasureIndexOfRole(grouped, ColumnValue);
    const categoryIndex: number = getCategoryIndexOfRole(categories, ColumnCategory);
    const gradientIndex: number = getMeasureIndexOfRole(grouped, ColumnGradient);
    let valueCol: DataViewMetadataColumn;
    let categoryCol: DataViewMetadataColumn;

    if (grouped && grouped.length) {
        const firstGroup: DataViewValueColumnGroup = grouped[0];

        if (valueIndex >= 0) {
            valueCol = firstGroup.values[valueIndex].source;
            xAxisLabel = firstGroup.values[valueIndex].source.displayName;
        }

        if (categoryIndex >= 0) {
            categoryCol = categories[categoryIndex].source;
            yAxisLabel = categories[categoryIndex].source.displayName;
        }
    }

    return {
        idx: {
            category: categoryIndex,
            value: valueIndex,
            gradient: gradientIndex,
            columnBy: getCategoryIndexOfRole(categories, ColumnColumnBy),
            rowBy: getCategoryIndexOfRole(categories, ColumnRowBy)
        },
        cols: {
            value: valueCol,
            category: categoryCol
        },
        labels: {
            x: xAxisLabel,
            y: yAxisLabel
        },
        groupingColumn: source
    };
}
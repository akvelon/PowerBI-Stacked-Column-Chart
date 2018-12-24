/*
 *  Power BI Visualizations
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

module powerbi.extensibility.visual {
    import converterHelper = powerbi.extensibility.utils.dataview.converterHelper;
    import ValueFormatter = powerbi.extensibility.utils.formatting.valueFormatter;
    import ColorHelper = powerbi.extensibility.utils.color.ColorHelper;

    export enum Field {
        Axis = <any>"Axis",
        Legend = <any>"Legend",
        Value = <any>"Value",
        Gradient = <any>"Gradient",
        ColumnBy = <any>"ColumnBy",
        RowBy = <any>"RowBy",
        Tooltips = <any>"Tooltips",
        GroupedValues = <any>"GroupedValues"
    }

    export class DataViewConverter<T> {
        private static Highlighted: string = "Highlighted";
        private static Blank: string = "(Blank)"; 
        public static Convert(dataView: DataView, hostService: IVisualHost, settings: VisualSettings, legendColors: Array<string>): VisualDataPoint[] {

            if (this.IsAxisAndLegendSameField(dataView)) {
                return this.GetDataPointsForSameAxisAndLegend(dataView, hostService, legendColors);
            } else if (this.IsLegendFilled(dataView)) {
                return this.GetDataPointsForLegend(dataView, hostService, legendColors);
            } else if (this.IsMultipleValues(dataView)) {
                return this.GetDataPointsForMultipleValues(dataView, hostService, legendColors);
            }

            return this.GetDataPointsWithoutLegend(dataView, hostService, settings);
        }

        public static IsLegendNeeded(dataView: DataView) {
            return this.IsLegendFilled(dataView) || this.IsMultipleValues(dataView);
        }

        private static IsAxisAndLegendSameField(dataView: DataView): boolean {
            const columns: DataViewValueColumns = dataView.categorical.values;

            if (columns.source && columns.source.roles[Field.Legend] && columns.source.roles[Field.Axis]) {
                return true;
            }

            return false;
        }

        public static IsAxisFilled(dataView: DataView): boolean {
            if (dataView.categorical 
                && dataView.categorical.values 
                && dataView.categorical.values.source 
                && dataView.categorical.values.source.roles[Field.Axis]) {
                return true;
            }

            const columns: DataViewCategoricalColumn[] = dataView.categorical.categories;

            if (columns && columns.filter(x => x.source && x.source.roles[Field.Axis]).length) {
                return true;
            }

            return false;
        }

        public static IsCategoryFilled(dataView: DataView, categoryField: Field): boolean {
            if (dataView.categorical 
                && dataView.categorical.values 
                && dataView.categorical.values.source 
                && dataView.categorical.values.source.roles[categoryField]) {
                return true;
            }

            const columns: DataViewCategoricalColumn[] = dataView.categorical.categories;

            if (columns && columns.filter(x => x.source && x.source.roles[categoryField]).length) {
                return true;
            }

            return false;
        }

        public static IsValueFilled(dataView: DataView): boolean {
            const columns: DataViewValueColumns = dataView.categorical.values;

            if (!columns) {
                return false;
            }

            if (columns.source && columns.source.roles[Field.Value] || columns.filter(x => x.source && x.source.roles[Field.Value]).length) {
                return true;
            }

            return false;
        }

        public static IsLegendFilled(dataView: DataView): boolean {
            const columns: DataViewValueColumns = dataView.categorical.values;

            if (columns.source && columns.source.roles[Field.Legend]) {
                return true;
            }

            return false;
        }

        public static IsMultipleValues(dataView: DataView): boolean {
            const columns: DataViewMetadataColumn[] = dataView.metadata.columns;
            let valueFieldsCount: number = 0;

            for (let columnName in columns) {
                const column: DataViewMetadataColumn = columns[columnName];

                if (column.roles && column.roles[Field.Value]) {
                    ++valueFieldsCount;
                    if (valueFieldsCount > 1) {
                        return true;
                    }
                }
            }

            return false;
        }

        // Legend bucket is filled
        private static GetDataPointsForSameAxisAndLegend(dataView: DataView, hostService: IVisualHost, legendColors: Array<string>): VisualDataPoint[] {
            let columns: VisualColumns = this.GetGroupedValueColumns(dataView);

            let data: VisualDataPoint[] = [];

            let seriesColumn: DataViewValueColumns = columns[Field.GroupedValues];
            let groupedValues: DataViewValueColumnGroup[] = seriesColumn.grouped ? seriesColumn.grouped() : null;

            columns[Field.Legend].forEach((legend, k) => {
                let value: number = columns[Field.Value][k].values[0];
                let color = legendColors[k];

                let tooltipItems: VisualTooltipDataItem[] = [];

                const groupMetadata: DataViewMetadataColumn = columns[Field.GroupedValues].source,
                    valueMetadata: DataViewMetadataColumn = columns[Field.Value][k].source;

                tooltipItems.push(this.createTooltipData(groupMetadata, legend));
                tooltipItems.push(this.createTooltipData(valueMetadata, value));

                if (columns[Field.Tooltips] && columns[Field.Tooltips].length) {
                    columns[Field.Tooltips].filter(x => x.source.groupName === legend).forEach(tooltipColumn => {
                        const tooltipValue = tooltipColumn.values[k],
                            tooltipMetadata: DataViewMetadataColumn = tooltipColumn.source;

                        tooltipItems.push(this.createTooltipData(tooltipMetadata, tooltipValue));
                    });
                }

                let identity: ISelectionId = hostService.createSelectionIdBuilder()
                    .withSeries(columns[Field.GroupedValues], groupedValues[k])
                    .withMeasure(seriesColumn[k].source.queryName)
                    .createSelectionId();

                if (value != null) {
                    data.push({
                        category: !legend ? this.Blank : legend,
                        series: legend,
                        value: value,
                        valueForHeight: value > 0 ? value : -value, 
                        shiftValue: value < 0 ? value : 0,
                        sum: value,
                        selected: false,
                        identity: identity,
                        color: color,
                        tooltips: tooltipItems
                    });

                    let highlightValue: number = columns[Field.Value][k].highlights ? columns[Field.Value][k].highlights[0] : null;

                    if (highlightValue != null) {
                        let highlightTooltipItems: VisualTooltipDataItem[] = tooltipItems.slice();

                        highlightTooltipItems.push(this.createTooltipData(valueMetadata, highlightValue, this.Highlighted));

                        data.push({
                            category: !legend ? this.Blank : legend,
                            series: legend,
                            valueForHeight: highlightValue > 0 ? highlightValue : -highlightValue,
                            value: highlightValue,
                            shiftValue: highlightValue < 0 ? highlightValue : 0,
                            selected: false,
                            identity: identity,
                            highlight: true,
                            color: color,
                            tooltips: highlightTooltipItems
                        });
                    }
                }
            });

            return data;
        }

        // Legend bucket is filled
        private static GetDataPointsForLegend(dataView: DataView, hostService: IVisualHost, legendColors: Array<string>): VisualDataPoint[] {
            let columns: VisualColumns = this.GetGroupedValueColumns(dataView);

            let data: VisualDataPoint[] = [];

            let categoryColumn: DataViewCategoryColumn = columns[Field.Axis][0],
                seriesColumn: DataViewValueColumns = columns[Field.GroupedValues],
                groupedValues: DataViewValueColumnGroup[] = seriesColumn.grouped ? seriesColumn.grouped() : null;

            categoryColumn.values.forEach((categoryValue, i) => {
                let sum: number = 0;
                let negativeSum: number = 0;

                let columnBy: PrimitiveValue = columns[Field.ColumnBy] && columns[Field.ColumnBy][0].values[i],
                    rowBy: PrimitiveValue = columns[Field.RowBy] && columns[Field.RowBy][0].values[i];

                columns[Field.Legend].forEach((legend, k) => {
                    let value: number = columns[Field.Value][k].values[i];
                    let color = legendColors[k];

                    let identity: ISelectionId = hostService.createSelectionIdBuilder()
                        .withCategory(categoryColumn, i)
                        .withSeries(seriesColumn, groupedValues[k])
                        .withMeasure(seriesColumn[k].source.queryName)
                        .createSelectionId();

                    if (value != null) {
                        let tooltipItems: VisualTooltipDataItem[] = [];

                        const categoryMetadata: DataViewMetadataColumn = categoryColumn.source,
                            groupMetadata: DataViewMetadataColumn = columns[Field.GroupedValues].source,
                            valueMetadata: DataViewMetadataColumn = columns[Field.Value][k].source;

                        tooltipItems.push(this.createTooltipData(categoryMetadata, categoryValue));
                        tooltipItems.push(this.createTooltipData(groupMetadata, legend));
                        tooltipItems.push(this.createTooltipData(valueMetadata, value));

                        if (columns[Field.Tooltips] && columns[Field.Tooltips].length) {
                            columns[Field.Tooltips].filter(x => x.source.groupName === legend).forEach(tooltipColumn => {
                                const tooltipValue = tooltipColumn.values[i],
                                    tooltipMetadata: DataViewMetadataColumn = tooltipColumn.source;

                                tooltipItems.push(this.createTooltipData(tooltipMetadata, tooltipValue));
                            });
                        }

                        data.push({
                            category: !categoryValue ? "(Blank)" : categoryValue,
                            series: legend,
                            value: value,
                            valueForHeight: value > 0 ? value : -value,
                            shiftValue: value >= 0 ? sum : negativeSum + value,
                            sum: value >= 0 ? sum + value : negativeSum + value,
                            selected: false,
                            identity: identity,
                            tooltips: tooltipItems,
                            color: color,
                            columnBy: columnBy,
                            rowBy: rowBy
                       });

                        let highlightValue: number = columns[Field.Value][k].highlights ? columns[Field.Value][k].highlights[i] : null;

                        if (highlightValue != null) {
                            let highlightTooltipItems: VisualTooltipDataItem[] = tooltipItems.slice();

                            highlightTooltipItems.push(this.createTooltipData(valueMetadata, highlightValue, this.Highlighted));

                            data.push({
                                category: !categoryValue ? "(Blank)" : categoryValue,
                                series: legend,
                                value: highlightValue,
                                valueForHeight: highlightValue > 0 ? highlightValue : -highlightValue,
                                shiftValue: value >= 0 ? sum : negativeSum + highlightValue,
                                selected: false,
                                identity: identity,
                                highlight: true,
                                tooltips: highlightTooltipItems,
                                color: color,
                                columnBy: columnBy,
                                rowBy: rowBy
                            });
                        }

                        sum += value > 0 ? value : 0;
                        negativeSum += value < 0 ? value : 0;
                    }
                });
            });

            return data;
        }

        // Legend bucket is empty. Used multiple fields in "Value" bucket
        private static GetDataPointsForMultipleValues(dataView: DataView, hostService: IVisualHost, legendColors: Array<string>): VisualDataPoint[] {
            let columns: VisualColumns = this.GetColumnsForMultipleValues(dataView);

            let data: VisualDataPoint[] = [];

            let categoryColumn: DataViewCategoryColumn = columns[Field.Axis][0];

            categoryColumn.values.forEach((category, i) => {
                let sum: number = 0;
                let negativeSum: number = 0;

                let columnBy: PrimitiveValue = columns[Field.ColumnBy] && columns[Field.ColumnBy][0].values[i],
                    rowBy: PrimitiveValue = columns[Field.RowBy] && columns[Field.RowBy][0].values[i];

                columns[Field.Value].forEach((valueColumn, k) => {
                    let value: number = valueColumn.values[i];
                    let color = legendColors[k];

                    let identity: ISelectionId = hostService.createSelectionIdBuilder()
                        .withCategory(categoryColumn, i)
                        .withMeasure(columns.Value[k].source.queryName)
                        .createSelectionId();

                    if (value != null) {
                        let tooltipItems: VisualTooltipDataItem[] = [];

                        const categoryMetadata: DataViewMetadataColumn = categoryColumn.source,
                            valueMetadata: DataViewMetadataColumn = valueColumn.source;

                        tooltipItems.push(this.createTooltipData(categoryMetadata, category));
                        tooltipItems.push(this.createTooltipData(valueMetadata, value));

                        if (columns[Field.Tooltips] && columns[Field.Tooltips].length) {
                            columns[Field.Tooltips].forEach(tooltipColumn => {
                                const tooltipValue = tooltipColumn.values[i],
                                    tooltipMetadata: DataViewMetadataColumn = tooltipColumn.source;

                                tooltipItems.push(this.createTooltipData(tooltipMetadata, tooltipValue));
                            });
                        }

                        data.push({
                            category: !category ? "(Blank)" : category,
                            value: value,
                            valueForHeight: value > 0 ? value : -value,
                            shiftValue: value >= 0 ? sum : negativeSum + value,
                            sum: value >= 0 ? sum + value : negativeSum + value,
                            selected: false,
                            identity: identity,
                            tooltips: tooltipItems,
                            color: color,
                            columnBy: columnBy,
                            rowBy: rowBy
                        });

                        let highlightValue: number = valueColumn.highlights ? valueColumn.highlights[i] : null;

                        if (highlightValue != null) {
                            let highlightTooltipItems: VisualTooltipDataItem[] = tooltipItems.slice();

                            highlightTooltipItems.push(this.createTooltipData(valueMetadata, highlightValue, this.Highlighted));

                            data.push({
                                category: !category ? "(Blank)" : category,
                                value: highlightValue,
                                valueForHeight: highlightValue > 0 ? highlightValue : -highlightValue, 
                                shiftValue: value >= 0 ? sum : negativeSum + highlightValue,
                                selected: false,
                                identity: identity,
                                highlight: true,
                                tooltips: tooltipItems,
                                color: color,
                                columnBy: columnBy,
                                rowBy: rowBy
                            });
                        }

                        sum += value > 0 ? value : 0;
                        negativeSum += value < 0 ? value : 0;
                    }
                });
            });

            return data;
        }

        // Legend bucket is empty. Single field in "Value" bucket
        private static GetDataPointsWithoutLegend(dataView: DataView, hostService: IVisualHost, settings: VisualSettings): VisualDataPoint[] {
            let columns: VisualColumns = this.GetColumnsWithNoLegend(dataView);

            let data: VisualDataPoint[] = [];

            let categoryColumn: DataViewCategoryColumn = columns[Field.Axis][0];

            let colorHelper = new ColorHelper(
                hostService.colorPalette,
                {
                    objectName: "dataPoint",
                    propertyName: "fill"
                },
                settings.dataPoint.fill
            );

            categoryColumn.values.forEach((category, i) => {
                let sum: number = 0;
                let negativeSum: number = 0;

                const value: number = columns[Field.Value].values[i],
                    colorSaturationCol = columns[Field.Gradient],
                    colorSaturation: number = colorSaturationCol && colorSaturationCol.values[i] ? columns[Field.Gradient].values[i] : null;

                let columnBy: PrimitiveValue = columns[Field.ColumnBy] && columns[Field.ColumnBy][0].values[i],
                    rowBy: PrimitiveValue = columns[Field.RowBy] && columns[Field.RowBy][0].values[i];

                let identity: ISelectionId = hostService.createSelectionIdBuilder()
                    .withCategory(categoryColumn, i)
                    .createSelectionId();

                if (value != null) {
                    let color = colorHelper.getColorForMeasure(
                        categoryColumn.objects && categoryColumn.objects[i],
                        "");

                    let tooltipItems: VisualTooltipDataItem[] = [];

                    const categoryMetadata: DataViewMetadataColumn = categoryColumn.source,
                        valueMetadata: DataViewMetadataColumn = columns[Field.Value].source;

                    tooltipItems.push(this.createTooltipData(categoryMetadata, category));
                    tooltipItems.push(this.createTooltipData(valueMetadata, value));

                    if (columns[Field.Tooltips] && columns[Field.Tooltips].length) {
                        columns[Field.Tooltips].forEach(tooltipColumn => {
                            const tooltipValue = tooltipColumn.values[i],
                                tooltipMetadata: DataViewMetadataColumn = tooltipColumn.source;

                            tooltipItems.push(this.createTooltipData(tooltipMetadata, tooltipValue));
                        });
                    }

                    data.push({
                        category: !category ? "(Blank)" : category,
                        value: value,
                        valueForHeight: value > 0 ? value : -value,
                        shiftValue: value >= 0 ? sum : negativeSum + value,
                        sum: value >= 0 ? sum + value : negativeSum + value,
                        colorSaturation: colorSaturation,
                        selected: false,
                        identity: identity,
                        color: color,
                        tooltips: tooltipItems,
                        columnBy: columnBy,
                        rowBy: rowBy
                    });

                    let highlightValue: number = columns[Field.Value].highlights ? columns[Field.Value].highlights[i] : null;

                    if (highlightValue != null) {
                        let highlightTooltipItems: VisualTooltipDataItem[] = tooltipItems.slice();

                        highlightTooltipItems.push(this.createTooltipData(valueMetadata, highlightValue, this.Highlighted));

                        data.push({
                            category: !category ? "(Blank)" : category,
                            value: highlightValue,
                            valueForHeight: highlightValue > 0 ? highlightValue : -highlightValue,
                            shiftValue: value >= 0 ? sum : negativeSum + highlightValue,
                            sum: sum + value,
                            selected: false,
                            identity: identity,
                            highlight: true,
                            color: color,
                            tooltips: highlightTooltipItems,
                            columnBy: columnBy,
                            rowBy: rowBy
                        });
                    }

                    sum += value > 0 ? value : 0;
                    negativeSum += value < 0 ? value : 0;
                }
            });

            return data;
        }

        private static GetGroupedValueColumns(dataView: DataView): VisualColumns {
            let categorical: DataViewCategorical = dataView && dataView.categorical;
            let categories: DataViewCategoricalColumn[] = categorical && categorical.categories || [];
            let values: DataViewValueColumns = categorical && categorical.values;
            let series: PrimitiveValue[] = categorical && values.source && this.getSeriesValues(dataView);
            let grouped: DataViewValueColumnGroup[] = values && values.grouped();

            let data: VisualColumns = new VisualColumns();

            if (grouped) {
                data[Field.GroupedValues] = values;

                grouped.forEach(x => {
                    for (let prop in data) {
                        let columnArray: DataViewValueColumn[] = x.values.filter(y => y.source.roles[prop]);

                        if (columnArray.length) {
                            if (!data[prop]) {
                                data[prop] = columnArray;
                            } else {
                                data[prop].push(...columnArray);
                            }
                        }
                    }
                });
            }

            if (categorical) {
                for (let prop in data) {
                    let columnArray: DataViewValueColumn[] = <DataViewValueColumn[]>categories.filter(y => y.source.roles[prop]);

                    if (columnArray.length) {
                        data[prop] = columnArray;
                    }
                }
            }

            if (series) {
                data[Field.Legend] = series.filter((v, i, a) => a.indexOf(v) === i);
            }

            return data;
        }

        private static GetColumnsForMultipleValues(dataView: DataView): VisualColumns {
            let categorical: DataViewCategorical = dataView && dataView.categorical;
            let categories: DataViewCategoricalColumn[] = categorical && categorical.categories || [];
            let values: DataViewValueColumns = categorical && categorical.values;

            let data: VisualColumns = new VisualColumns();

            if (categorical && values) {
                let valueColumns: DataViewValueColumn[] = values.filter(y => y.source.roles[Field.Value]);

                if (valueColumns.length) {
                    if (!data[Field.Value]) {
                        data[Field.Value] = valueColumns;
                    }
                }

                let toolipColumns: DataViewValueColumn[] = values.filter(y => y.source.roles[Field.Tooltips]);

                if (toolipColumns.length) {
                    if (!data[Field.Tooltips]) {
                        data[Field.Tooltips] = toolipColumns;
                    }
                }

                for (let prop in data) {
                    let columnArray: DataViewValueColumn[] = <DataViewValueColumn[]>categories.filter(y => y.source.roles[prop]);

                    if (columnArray.length) {
                        data[prop] = columnArray;
                    }
                }
            }

            return data;
        }

        private static GetColumnsWithNoLegend(dataView: DataView): VisualColumns {
            let categorical: DataViewCategorical = dataView && dataView.categorical;
            let categories: DataViewCategoricalColumn[] = categorical && categorical.categories || [];
            let values: DataViewValueColumns = categorical && categorical.values;

            let data: VisualColumns = new VisualColumns();

            if (categorical && values) {
                let valueColumns: DataViewValueColumn[] = values.filter(y => y.source.roles[Field.Value]);

                if (valueColumns.length) {
                    if (!data[Field.Value]) {
                        data[Field.Value] = valueColumns[0];
                    }
                }

                let toolipColumns: DataViewValueColumn[] = values.filter(y => y.source.roles[Field.Tooltips]);

                if (toolipColumns.length) {
                    if (!data[Field.Tooltips]) {
                        data[Field.Tooltips] = toolipColumns;
                    }
                }

                for (let prop in data) {
                    let columnArray: DataViewValueColumn[] = <DataViewValueColumn[]>categories.filter(y => y.source.roles[prop]);

                    if (columnArray.length) {
                        data[prop] = columnArray;
                    }
                }
            }

            return data;
        }

        private static createTooltipData(metadataColumn: DataViewMetadataColumn, value: PrimitiveValue, displayName?: string): VisualTooltipDataItem {
            return {
                displayName: displayName ? displayName : metadataColumn.displayName,
                value: this.getFormattedValue(metadataColumn, value)
            };
        }

        private static getSeriesValues(dataView: DataView): PrimitiveValue[] {
            return dataView && dataView.categorical && dataView.categorical.values
                && dataView.categorical.values.map(x => converterHelper.getSeriesName(x.source));
        }

        private static getFormattedValue(column: DataViewMetadataColumn, value: any) {
            let formatString: string = this.getFormatStringFromColumn(column);

            return ValueFormatter.format(value, formatString);
        }

        private static getFormatStringFromColumn(column: DataViewMetadataColumn): string {
            if (column) {
                let formatString: string = ValueFormatter.getFormatStringByColumn(column, false);

                return formatString || column.format;
            }

            return null;
        }
    }
}
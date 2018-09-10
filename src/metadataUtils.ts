module powerbi.extensibility.visual.metadataUtils {
    import getMeasureIndexOfRole = powerbi.extensibility.utils.dataview.DataRoleHelper.getMeasureIndexOfRole;
    import getCategoryIndexOfRole = powerbi.extensibility.utils.dataview.DataRoleHelper.getCategoryIndexOfRole;

    const ColumnCategory: string = "Axis";
    const ColumnValue: string = "Value";
    const ColumnGradient: string = "Gradient";

    export function getMetadata(
        categories: DataViewCategoryColumn[],
        grouped: DataViewValueColumnGroup[],
        source: DataViewMetadataColumn): VisualMeasureMetadata {

        let xAxisLabel: string = "",
            yAxisLabel: string = "",
            valueIndex: number = getMeasureIndexOfRole(grouped, ColumnValue),
            categoryIndex: number = getCategoryIndexOfRole(categories, ColumnCategory),
            gradientIndex: number = getMeasureIndexOfRole(grouped, ColumnGradient),
            valueCol: DataViewMetadataColumn,
            categoryCol: DataViewMetadataColumn;


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
                gradient: gradientIndex
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
}
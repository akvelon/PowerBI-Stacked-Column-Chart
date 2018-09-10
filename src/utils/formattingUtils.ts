module powerbi.extensibility.visual.formattingUtils {
    import ValueFormatter = powerbi.extensibility.utils.formatting.valueFormatter;
    import PixelConverter = powerbi.extensibility.utils.type.PixelConverter;
    import dataLabelUtils = powerbi.extensibility.utils.chart.dataLabel.utils;
    import TextProperties = powerbi.extensibility.utils.formatting.TextProperties;

    export function getFormatStringByColumn(column: DataViewMetadataColumn) {
        return !column.format && column.type.numeric ? "0.00" : ValueFormatter.getFormatStringByColumn(column);
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
        let fontSizeInPx: string = PixelConverter.fromPoint(settings.fontSize);
        let fontFamily: string = settings.fontFamily ? settings.fontFamily : dataLabelUtils.LabelTextProperties.fontFamily;

        return {
            fontSize: fontSizeInPx.toString(),
            fontFamily: fontFamily
        };
    }

    export function getTextPropertiesForHeightCalculation(settings: categoryLabelsSettings): TextProperties  {
        let fontFamily: string = settings.fontFamily ? settings.fontFamily : dataLabelUtils.LabelTextProperties.fontFamily;

        return  {
            fontSize: settings.fontSize.toString(),
            fontFamily: fontFamily
        };
    }
}
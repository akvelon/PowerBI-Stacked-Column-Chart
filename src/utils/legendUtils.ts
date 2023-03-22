module powerbi.extensibility.visual.legendUtils {
    import legend = powerbi.extensibility.utils.chart.legend;
    import ColorHelper = powerbi.extensibility.utils.color.ColorHelper;
    import ILegend = powerbi.extensibility.utils.chart.legend.ILegend;
    import LegendData = powerbi.extensibility.utils.chart.legend.LegendData;
    import legendDataModule = powerbi.extensibility.utils.chart.legend.data;
    import legendModule = powerbi.extensibility.utils.chart.legend;
    import legendProps = powerbi.extensibility.utils.chart.legend.legendProps;
    import LegendPosition = powerbi.extensibility.utils.chart.legend.LegendPosition;
    import DataViewValueColumns = powerbi.DataViewValueColumns;
    import valueFormatter = powerbi.extensibility.utils.formatting.valueFormatter;
    import LegendDataPoint = powerbi.extensibility.utils.chart.legend.LegendDataPoint;

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
        hasDynamicSeries: boolean): legend.LegendData {

        const colorHelper: ColorHelper = new ColorHelper(
            host.colorPalette,
            {objectName: "dataPoint", propertyName: "fill"});

        const legendItems: legend.LegendDataPoint[] = [];
        const grouped: DataViewValueColumnGroup[] = dataValues.grouped();
        const formatString: string = valueFormatter.getFormatStringByColumn(dataValueSource);

        if (hasDynamicSeries) {
            for (let i: number = 0, len: number = grouped.length; i < len; i++) {
                let grouping: DataViewValueColumnGroup = grouped[i],
                    selectionId: ISelectionId,
                    color: string;
                color = colorHelper.getColorForSeriesValue(
                    grouping.objects,
                    grouping.name);

                selectionId = host.createSelectionIdBuilder()
                    .withSeries(dataValues, grouping)
                    .createSelectionId();

                legendItems.push({
                    color: color,
                    icon: legend.LegendIcon.Circle,
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

    export function getSuitableLegendData( dataView: DataView, host: IVisualHost, legend: legendSettings): legend.LegendData {
        let legendData: LegendData;
        const numberOfValueFields = visualUtils.getNumberOfValues(dataView);
        if (DataViewConverter.IsLegendFilled(dataView)) {
            legendData = legendUtils.buildLegendData(dataView.categorical.values,
                host,
                legend,
                dataView.categorical.values.source,
                dataView.categorical.categories || [],
                metadataUtils.getMetadata(dataView.categorical.categories, dataView.categorical.values.grouped(), dataView.metadata.columns[0]).idx.category,
                !!dataView.categorical.values.source);
        } else if (numberOfValueFields > 1) {

            legendData = legendUtils.buildLegendDataForMultipleValues(host,
                dataView,
                numberOfValueFields);
        }
        return legendData;
    }

    export function getLegendColors(legendDataPoints: LegendDataPoint[]): Array<string> {
        let legendColors = [];

        legendDataPoints.forEach(legendDataPoint => legendColors.push(legendDataPoint.color));

        return legendColors;
    }

    export function buildLegendDataForMultipleValues(
        host: IVisualHost,
        dataView: DataView,
        numberOfValueFields: number): legend.LegendData {

        let colorHelper: ColorHelper = new ColorHelper(
            host.colorPalette,
            {objectName: "dataPoint", propertyName: "fill"});

        const legendItems: legend.LegendDataPoint[] = [];

        const values = dataView.categorical.values;

        for (let i = 0; i < numberOfValueFields; i++) {
            let color: string;
            let selectionId: ISelectionId;

            color = colorHelper.getColorForMeasure(
                values[i].source.objects,
                i + "value");

            selectionId = host.createSelectionIdBuilder()
                .withMeasure(values[i].source.queryName)
                .createSelectionId();

            legendItems.push({
                color: color,
                icon: legend.LegendIcon.Circle,
                label: values[i].source.displayName,
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
        svg: d3Selection<SVGElement>,
        viewport: IViewport,
        legendProperties: LegendProperties,
        legendElement): void {
        const legendDataForRender: LegendData = {
            title: "",
            dataPoints: []
        };

        let legendObject: DataViewObject = legendProperties.legendObject;
        let legendData: LegendData = legendProperties.data;

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
            legendDataModule.update(legendDataForRender, legendObject);

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

        legendModule.positionChartArea(svg, legend);
    }


    export function getLegendProperties(
        legendSettings: legendSettings): DataViewObject {

        let dataViewObject: DataViewObject;

        dataViewObject =  {
            show: legendSettings.show,
            position: legendSettings.position,
            showTitle: legendSettings.showTitle,
            titleText: legendSettings.legendName,
            legendNameColor: legendSettings.legendNameColor,
            fontSize: legendSettings.fontSize,
            fontFamily: legendSettings.fontFamily,
        };

        return dataViewObject;
    }

    export function setLegendProperties(dataView: DataView, host: IVisualHost, settings: legendSettings): LegendProperties {
        let legendObject: DataViewObject = legendUtils.getLegendProperties(settings);
        let legendData = legendUtils.getSuitableLegendData(dataView, host, settings);
        const legendIsRendered = legendData === undefined ? false : legendData.dataPoints.length > 0;
        const legendColors = legendIsRendered ? legendUtils.getLegendColors(legendData.dataPoints) : [];

        return {
            legendObject: legendObject,
            data: legendData,
            colors: legendColors,
        }
    }


}
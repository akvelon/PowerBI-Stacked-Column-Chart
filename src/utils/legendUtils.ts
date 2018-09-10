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
        svg: d3.Selection<SVGElement>,
        viewport: IViewport,
        layerLegendData: LegendData,
        legendObjectProperties: DataViewObject,
        legendElement): void {
        const legendData: LegendData = {
            title: "",
            dataPoints: []
        };

        legendData.labelColor = legendObjectProperties.legendNameColor as string;
        legendData.title = legendObjectProperties.titleText as string;

        const legend: ILegend = visualLegend;

        if (layerLegendData) {
            legendData.dataPoints = legendData.dataPoints.concat(layerLegendData.dataPoints || []);

            legendData.fontSize = this.legendLabelFontSize
                ? this.legendLabelFontSize
                : LegendLabelFontSizeDefault;

            legendData.grouped = !!layerLegendData.grouped;
        }

        const legendProperties: DataViewObject = legendObjectProperties;

        if (legendProperties) {
            legendDataModule.update(legendData, legendProperties);

            const position: string = legendProperties[legendProps.position] as string;

            if (position) {
                legend.changeOrientation(LegendPosition[position]);
            }
        }
        else {
            legend.changeOrientation(LegendPosition.Top);
        }

        if (legendData.dataPoints.length === MinAmountOfDataPointsInTheLegend
            && !legendData.grouped) {
            // legendData.dataPoints = [];
        }

        legend.drawLegend(legendData, {
            height: viewport.height,
            width: viewport.width
        });

        legendModule.positionChartArea(svg, legend);

        let legendItems: Array<any> = [].slice.call(legendElement[0][0].children ? legendElement[0][0].children : legendElement[0][0].childNodes);

        legendItems = legendItems.filter(item => (item.classList.value === "legendItem" || item.classList.value === "legendTitle"));

        if (legendItems && legendItems.length > 0) {
            let offset: number = 0;

            legendItems.forEach((item, i, arr) => {
                item.style.fontFamily = DefaultFontFamily;
                let oldWidth = item.getBoundingClientRect().width;
                item.style.fontFamily = <string>legendObjectProperties.fontFamily || DefaultFontFamily;
                let newWidth = item.getBoundingClientRect().width;

                let orientation = legend.getOrientation();

                if (orientation === LegendPosition.Right ||
                    orientation === LegendPosition.RightCenter ||
                    orientation === LegendPosition.Left ||
                    orientation === LegendPosition.LeftCenter) {
                    item.style.transform = `translateX(${0}px)`;
                    // TODO: add processing for left right position
                } else {
                    item.style.transform = `translateX(${offset}px)`;
                }
                offset += newWidth - oldWidth;
            });
        }
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


}
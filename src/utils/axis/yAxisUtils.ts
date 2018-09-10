module powerbi.extensibility.visual.xAxisUtils {
    export const getXAxisMaxWidth = (visualWidth, settings) => ((visualWidth) / 100) * settings.categoryAxis.maximumSize;
}


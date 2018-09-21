module powerbi.extensibility.visual.selectionSaveUtils {
    export function saveSelection(selection: VisualDataPoint[], host: IVisualHost): void {
        const instance: VisualObjectInstance = {
            objectName: "selectionSaveSettings",
            selector: undefined,
            properties: {
                selection: JSON.stringify(selection)
            }
        };

        host.persistProperties({
            replace: [
                instance
            ]
        });
    }
}
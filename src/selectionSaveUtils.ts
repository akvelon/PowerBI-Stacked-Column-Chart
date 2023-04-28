"use strict";

import powerbiApi from "powerbi-visuals-api";
import { VisualDataPoint } from "./visualInterfaces";
import VisualObjectInstance = powerbiApi.VisualObjectInstance;
import IVisualHost = powerbiApi.extensibility.visual.IVisualHost;

export function saveSelection(selection: VisualDataPoint[], host: IVisualHost): void {
    const instance: VisualObjectInstance = {
        objectName: "selectionSaveSettings",
        selector: <any>undefined,
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
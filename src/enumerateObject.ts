/* eslint-disable max-lines-per-function */
"use strict";

import powerbiApi from "powerbi-visuals-api";
import VisualObjectInstance = powerbiApi.VisualObjectInstance
import IVisualSelectionId = powerbiApi.visuals.ISelectionId;
import VisualObjectInstanceEnumerationObject = powerbiApi.VisualObjectInstanceEnumerationObject;


import { ColorHelper } from "powerbi-visuals-utils-colorutils";
import { legendInterfaces } from "powerbi-visuals-utils-chartutils";
import LegendDataPoint = legendInterfaces.LegendDataPoint;

import { AxisRangeType, LabelPosition, LayoutMode, VisualSettings } from "./settings";
import { VisualData, VisualDataPoint } from "./visualInterfaces";


export class EnumerateObject {
    private static fillDataPointInstancesForLegend(visualData: VisualData, instances: VisualObjectInstance[]) {
        for (const index in visualData.legendData.dataPoints) {
            const dataPoint: LegendDataPoint = visualData.legendData.dataPoints[index];

            instances.push({
                objectName: "dataPoint",
                displayName: dataPoint.label,
                selector: ColorHelper.normalizeSelector(
                    (dataPoint.identity as IVisualSelectionId).getSelector(),
                    false),
                properties: {
                    fill: { solid: { color: dataPoint.color } }
                }
            });
        }
    }

    private static fillDataPointInstancesForNoLegend(visualData: VisualData, instances: VisualObjectInstance[]) {
        for (const index in visualData.dataPoints) {
            const dataPoint: VisualDataPoint = visualData.dataPoints[index];

            instances.push({
                objectName: "dataPoint",
                displayName: dataPoint.category.toString(),
                selector: ColorHelper.normalizeSelector(
                    (dataPoint.identity as IVisualSelectionId).getSelector(),
                    false),
                properties: {
                    fill: { solid: { color: dataPoint.color } }
                }
            });
        }
    }

    public static setInstances(
        settings: VisualSettings,
        instanceEnumeration: any,
        yIsScalar: boolean,
        visualData: VisualData) {

        const instances: VisualObjectInstance[] = (instanceEnumeration as VisualObjectInstanceEnumerationObject).instances;
        const instance: VisualObjectInstance = instances[0];

        const isSmallMultiple: boolean = visualData.isSmallMultiple;
        const isCategorical: boolean = settings.categoryAxis.axisType === "categorical";

        switch (instance.objectName) {
            case "dataPoint": {
                if (visualData && visualData.legendData && visualData.legendData.dataPoints && visualData.legendData.dataPoints.length) {
                    this.fillDataPointInstancesForLegend(visualData, instances);

                    delete instance.properties["fill"];
                    delete instance.properties["showAllDataPoints"];
                } else if (visualData && visualData.dataPoints && settings.dataPoint.showAllDataPoints) {
                    this.fillDataPointInstancesForNoLegend(visualData, instances);
                }

                break;
            }
            case "categoryLabels": {
                if (!settings.categoryLabels.showBackground) {
                    delete instance.properties["transparency"];
                    delete instance.properties["backgroundColor"];
                }

                if (settings.categoryLabels.labelPosition === LabelPosition.OutsideEnd) {
                    delete instance.properties["overflowText"];
                }

                if (visualData && visualData.legendData && visualData.legendData.dataPoints && visualData.legendData.dataPoints.length) {
                    delete instance.properties["labelPosition"];
                } else {
                    delete instance.properties["labelPositionForFilledLegend"];
                }

                break;
            }
            case "categoryAxis": {
                if (!settings.categoryAxis.showTitle) {
                    delete instance.properties["titleStyle"];
                    delete instance.properties["axisTitleColor"];
                    delete instance.properties["axisTitle"];
                    delete instance.properties["titleFontSize"];
                    delete instance.properties["titleFontFamily"];
                }

                if (!isSmallMultiple) {
                    delete instance.properties["rangeType"];
                    delete instance.properties["rangeTypeNoScalar"];
                } else {
                    if (yIsScalar && !isCategorical) {
                        delete instance.properties["rangeTypeNoScalar"];
                    } else {
                        delete instance.properties["rangeType"];
                    }
                }

                if (yIsScalar) {
                    if (settings.categoryAxis.axisType === "categorical") {
                        delete instance.properties["axisScale"];
                        delete instance.properties["axisStyle"];
                        delete instance.properties["displayUnits"];
                        delete instance.properties["precision"];
                        delete instance.properties["start"];
                        delete instance.properties["end"];
                    } else if (settings.categoryAxis.axisType === "continuous") {
                        delete instance.properties["minCategoryWidth"];
                        delete instance.properties["maximumSize"];
                        delete instance.properties["innerPadding"];

                        if (visualData.isSmallMultiple) {
                            if (settings.categoryAxis.rangeType !== AxisRangeType.Custom) {                                    
                                delete instance.properties["start"];
                                delete instance.properties["end"];
                            }
                        }
                    }
                } else {
                    delete instance.properties["axisType"];
                    delete instance.properties["axisScale"];
                    delete instance.properties["axisStyle"];
                    delete instance.properties["displayUnits"];
                    delete instance.properties["precision"];                        
                    delete instance.properties["start"];
                    delete instance.properties["end"];
                }

                break;
            }
            case "valueAxis": {
                if (!isSmallMultiple) {
                    delete instance.properties["rangeType"];
                } else if (settings.valueAxis.rangeType !== AxisRangeType.Custom) {                                    
                    delete instance.properties["start"];
                    delete instance.properties["end"];
                }

                if (!settings.valueAxis.showTitle) {
                    delete instance.properties["titleStyle"];
                    delete instance.properties["axisTitleColor"];
                    delete instance.properties["axisTitle"];
                    delete instance.properties["titleFontSize"];
                    delete instance.properties["titleFontFamily"];
                }
                if (!settings.valueAxis.showGridlines) {
                    delete instance.properties["gridlinesColor"];
                    delete instance.properties["strokeWidth"];
                    delete instance.properties["lineStyle"];
                }

                break;
            }
            case "constantLine": {
                if (!settings.constantLine.dataLabelShow) {
                    delete instance.properties["fontColor"];
                    delete instance.properties["text"];
                    delete instance.properties["horizontalPosition"];
                    delete instance.properties["verticalPosition"];
                    delete instance.properties["displayUnits"];
                    delete instance.properties["precision"];
                }

                break;
            }
            case "smallMultiple": {
                if (settings.smallMultiple.layoutMode === LayoutMode.Matrix) {
                    delete instance.properties["maxRowWidth"];
                }

                if (!settings.smallMultiple.showChartTitle) {
                    delete instance.properties["fontFamily"];
                    delete instance.properties["fontSize"];
                    delete instance.properties["fontColor"];
                }
            }
        }
    }
}
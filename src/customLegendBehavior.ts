"use strict";

// powerbi.extensibility.utils.chartutils
import { legendInterfaces, legendBehavior } from "powerbi-visuals-utils-chartutils";
import LegendDataPoint = legendInterfaces.LegendDataPoint;
import LegendBehaviorOptions = legendBehavior.LegendBehaviorOptions;

// powerbi.extensibility.utils.interactivity
import { interactivityBaseService } from "powerbi-visuals-utils-interactivityutils";
import IInteractiveBehavior = interactivityBaseService.IInteractiveBehavior;
import ISelectionHandler = interactivityBaseService.ISelectionHandler;

import { d3Selection } from "./utils";

export class CustomLegendBehavior implements IInteractiveBehavior {
    public static dimmedLegendColor = "#A6A6A6";
    protected legendIcons: d3Selection<any>;
    private saveSelection: () => void;

    constructor(saveSelection: () => void){
        this.saveSelection = saveSelection;
    }

    public bindEvents(options: LegendBehaviorOptions, selectionHandler: ISelectionHandler): void {
        const legendItems = options.legendItems;
        this.legendIcons = options.legendIcons;
        const clearCatcher = options.clearCatcher;

        legendItems.on("click", (event: MouseEvent, d) => {
            selectionHandler.handleSelection(d, event.ctrlKey);
            this.saveSelection();
        });

        clearCatcher.on("click", () => {
            selectionHandler.handleClearSelection();
            this.saveSelection();
        });
    }

    public renderSelection(hasSelection: boolean): void {
        if (hasSelection) {
            this.legendIcons.style(
                "fill", (d: LegendDataPoint) => {
                    if (!d.selected) {
                        return CustomLegendBehavior.dimmedLegendColor;
                    }
                    else {
                        return d.color;
                    }
                }
            );
        }
        else {
            this.legendIcons.style(
                "fill", (d: LegendDataPoint) => {
                    return d.color;
                }
            );
        }
    }
}
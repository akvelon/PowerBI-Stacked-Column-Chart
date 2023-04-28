"use strict";

//utils
import { d3Selection } from "./utils";

// powerbi.visuals
import { interactivityBaseService } from "powerbi-visuals-utils-interactivityutils";
import IInteractiveBehavior = interactivityBaseService.IInteractiveBehavior;
import IInteractivityService = interactivityBaseService.IInteractivityService;
import ISelectionHandler = interactivityBaseService.ISelectionHandler;
import BaseDataPoint = interactivityBaseService.BaseDataPoint;
import IBehaviorOptions = interactivityBaseService.IBehaviorOptions;

//powerbi.api
import powerbiApi from "powerbi-visuals-api";
import IVisualHost = powerbiApi.extensibility.visual.IVisualHost;

import { IColVisual, VisualDataPoint } from "./visualInterfaces";
import * as visualUtils from "./utils";
import { Visual } from "./visual";

    export interface WebBehaviorOptions extends IBehaviorOptions<BaseDataPoint>{
        bars: d3Selection<any>;
        clearCatcher: d3Selection<any>;
        interactivityService: IInteractivityService<VisualDataPoint>;
        selectionSaveSettings?: any;
        host: IVisualHost;
    }

    export class WebBehavior implements IInteractiveBehavior {
        private visual: IColVisual;
        private options: WebBehaviorOptions;
        public selectionHandler: ISelectionHandler;

        constructor(visual: IColVisual) {
            this.visual = visual;
        }

        public bindEvents(options: WebBehaviorOptions, selectionHandler: ISelectionHandler) {
            this.options = options;
            this.visual.webBehaviorSelectionHandler = selectionHandler;
        }

        public renderSelection(hasSelection: boolean) {
            const hasHighlight = this.visual.getAllDataPoints().filter(x => x.highlight).length > 0;

            this.options.bars.style(
                "fill-opacity", (p: VisualDataPoint) => visualUtils.getFillOpacity(
                        p.selected,
                        p.highlight,
                        !p.highlight && hasSelection,
                        !p.selected && hasHighlight),
            )
            .style(
                "stroke", (p: VisualDataPoint)  => {
                    if (hasSelection && visualUtils.isSelected(p.selected,
                        p.highlight,
                        !p.highlight && hasSelection,
                        !p.selected && hasHighlight)) {
                            return Visual.DefaultStrokeSelectionColor;
                        }                        

                    return p.color;
                }
            )
            .style(
                "stroke-width", p => {
                    if (hasSelection && visualUtils.isSelected(p.selected,
                        p.highlight,
                        !p.highlight && hasSelection,
                        !p.selected && hasHighlight)) {
                        return Visual.DefaultStrokeSelectionWidth;
                    }

                    return Visual.DefaultStrokeWidth;
                }
            )
            .style("stroke-opacity", () => {
                    return hasSelection || hasHighlight ? 1 : 0
            })
        }
    }
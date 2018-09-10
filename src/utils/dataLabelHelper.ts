module powerbi.extensibility.visual {
    export class DataLabelHelper {
        public static labelBackgroundWidthPadding = 16.2;
        public static labelBackgroundHeightPadding = 2;
        public static labelBackgroundXShift = 7.5;
        public static labelBackgroundYShift = -2;
        private static dataLabelMargin: number = 6;

        public static canOverflow(settings: categoryLabelsSettings): boolean {
            if (settings.labelPosition === LabelPosition.InsideCenter || settings.labelPosition === LabelPosition.InsideBase) {
                return false;
            } else if (settings.labelPosition === LabelPosition.OutsideEnd || settings.labelPosition === LabelPosition.Auto) {
                return true;
            } else if (settings.overflowText) {
                return true;
            }

            return false;
        }

        private static calculateShiftForLegend(shift: number,
                                                labelHeight: number,
                                                barCoordinates: Coordinates,
                                                settings: categoryLabelsSettings) {

            let barY: number = barCoordinates.y,
                barHeight: number = barCoordinates.height,
                backGroundShift: number = settings.showBackground ? DataLabelHelper.labelBackgroundYShift : 0,
                labelTopBorderPosition: number = shift - labelHeight + backGroundShift,
                labelBottomBorderPosition: number = shift - backGroundShift;

            let maxPossibleTopPosition: number = barY,
                maxPossibleBottomPosition: number = barY + barHeight;

            const gap: number = 2;

            if (labelBottomBorderPosition + gap > maxPossibleBottomPosition) {
                shift = maxPossibleBottomPosition - gap + backGroundShift;

                if (shift - labelHeight < maxPossibleTopPosition) {
                    return null;
                }
            }

            if (labelTopBorderPosition < maxPossibleTopPosition) {
                shift = barY + labelHeight - backGroundShift;

                if (shift + gap > maxPossibleBottomPosition) {
                    return null;
                }
            }

            return shift;
        }

        private static calculateShiftForNoLegend(shift: number,
                                                labelHeight: number,
                                                chartHeight: number,
                                                barCoordinates: Coordinates,
                                                settings: categoryLabelsSettings) {

            let barY: number = barCoordinates.y,
                barHeight: number = barCoordinates.height,
                backGroundShift: number = settings.showBackground ? DataLabelHelper.labelBackgroundYShift : 0,
                labelTopBorderPosition: number = shift - labelHeight + backGroundShift,
                labelBottomBorderPosition: number = shift - backGroundShift;

            let canOverflow: boolean = DataLabelHelper.canOverflow(settings);

            let maxPossibleTopPosition: number = canOverflow ? 0 : barY,
                maxPossibleBottomPosition: number = barY + barHeight;

            if (labelBottomBorderPosition > maxPossibleBottomPosition) {
                shift = maxPossibleBottomPosition + backGroundShift;

                if (shift - labelHeight < maxPossibleTopPosition) {
                    return null;
                }
            } else if (labelTopBorderPosition < maxPossibleTopPosition) {
                shift = (settings.labelPosition === LabelPosition.OutsideEnd ? maxPossibleTopPosition + labelHeight - backGroundShift : barY + labelHeight - backGroundShift);

                if (shift > maxPossibleBottomPosition) {
                    return null;
                }
            }

            return shift;
        }

        public static calculatePositionShift(settings: categoryLabelsSettings,
                                            labelHeight: number,
                                            dataPoint: VisualDataPoint,
                                            chartHeight: number,
                                            isLegendRendered: boolean): number {

            let barCoordinates: Coordinates = dataPoint.barCoordinates;
            let shift: number = dataPoint.value >= 0 ? 
                                    this.calculateLabelPositionShift(settings, labelHeight, barCoordinates, isLegendRendered) : 
                                    this.calculateLabelPositionShiftForNegativeValues(settings, labelHeight, barCoordinates, isLegendRendered);

            if (isLegendRendered) {
                return this.calculateShiftForLegend(shift, labelHeight, barCoordinates, settings);
            } else {
                return this.calculateShiftForNoLegend(shift, labelHeight, chartHeight, barCoordinates, settings);
            }
        }

        private static calculateLabelPositionShift(settings: categoryLabelsSettings,
            labelHeight: number,
            barCoordinates: Coordinates,
            isLegendRendered: boolean): number {

            const backgroundMargin: number = settings.showBackground ? 2 : 0;

            let barY: number = barCoordinates.y,
                barHeight: number = barCoordinates.height;

            switch (settings.labelPosition) {
                case LabelPosition.OutsideEnd: {
                    return barY  - this.dataLabelMargin - backgroundMargin;
                }
                case LabelPosition.InsideEnd: {
                    return barY + labelHeight + backgroundMargin + this.dataLabelMargin;
                }
                case LabelPosition.InsideBase: {
                    return barY + barHeight - this.dataLabelMargin - backgroundMargin;
                }
                case LabelPosition.InsideCenter: {
                    return barY + barHeight / 2 + labelHeight / 2;
                }
                default: {
                    return isLegendRendered ? barY + barHeight / 2 + labelHeight / 2 : barY - this.dataLabelMargin - backgroundMargin;
                }
            }
        }

        private static calculateLabelPositionShiftForNegativeValues(settings: categoryLabelsSettings,
            labelHeight: number,
            barCoordinates: Coordinates,
            isLegendRendered: boolean): number {

            const backgroundMargin: number = settings.showBackground ? 2 : 0;

            let barY: number = barCoordinates.y,
                barHeight: number = barCoordinates.height;

            switch (settings.labelPosition) {
                case LabelPosition.OutsideEnd: {
                    return barY + this.dataLabelMargin + backgroundMargin;
                }
                case LabelPosition.InsideEnd: {
                    return barY + barHeight - backgroundMargin - this.dataLabelMargin;
                }
                case LabelPosition.InsideBase: {
                    return barY - labelHeight + this.dataLabelMargin + backgroundMargin;
                }
                case LabelPosition.InsideCenter: {
                    return barY + barHeight / 2 + labelHeight / 2;
                }
                default: {
                    return isLegendRendered ? barY + barHeight / 2 + labelHeight / 2 : barY + this.dataLabelMargin + backgroundMargin;
                }
            }
        }
    }
}
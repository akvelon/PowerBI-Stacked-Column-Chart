'use strict';

import {AxisOrientation} from 'powerbi-visuals-utils-chartutils/lib/axis/axisInterfaces';
import {HorizontalPosition, VerticalPosition, VisualSettings} from '../../settings';

export const getXAxisMaxWidth = (visualWidth: number, settings: VisualSettings) =>
    (visualWidth / 100) * settings.categoryAxis.maximumSize;


export function convertPositionToAxisOrientation(
    position: HorizontalPosition | VerticalPosition | string,
): AxisOrientation {
    switch (position) {
        case HorizontalPosition.Left:
            return AxisOrientation.left;

        case HorizontalPosition.Right:
            return AxisOrientation.right;

        case VerticalPosition.Top:
            return AxisOrientation.top;

        case VerticalPosition.Bottom:
            return AxisOrientation.bottom;
    }
}

module powerbi.extensibility.visual {
    import IAxisProperties = powerbi.extensibility.utils.chart.axis.IAxisProperties;
    import SelectableDataPoint = powerbi.extensibility.utils.interactivity.SelectableDataPoint;
    import LegendData = powerbi.extensibility.utils.chart.legend.LegendData;

    export interface IMargin {
        top: number;
        bottom: number;
        left: number;
        right: number;
    }

    export interface ISize {
        width: number;
        height: number;
    }

    export interface IAxes {
        x: IAxisProperties;
        y: IAxisProperties;
        xIsScalar?: boolean;
    }

    export interface VisualDataRow {
        rects: VisualDataRect[];
        category: PrimitiveValue;
    }

    export interface VisualDataRect {
        value: PrimitiveValue;
        color?: string;
        selectionId?: ISelectionId;
    }

    export class VisualColumns {
        public Axis: DataViewValueColumn = null;
        public Legend: DataViewValueColumn = null;
        public Value: DataViewValueColumn[] | DataViewValueColumn = null;
        public ColorSaturation: DataViewValueColumn = null;
        public Tooltips: DataViewValueColumn[] | DataViewValueColumn = null;
        public GroupedValues: DataViewValueColumns = null;
    }

    export interface VisualDataPoint extends SelectableDataPoint {
        value: number;
        valueForHeight: number;
        category: PrimitiveValue | number;
        shiftValue?: number;
        sum?: number;
        colorSaturation?: number;
        tooltips?: VisualTooltipDataItem[];
        series?: PrimitiveValue;
        color?: string;
        selectionId?: ISelectionId;
        highlight?: boolean;
        fill?: string;
        barCoordinates?: Coordinates;
        labelCoordinates?: Coordinates;
    }

    export interface Coordinates {
        x: number;
        y: number;
        width: number;
        height: number;
    }

    export interface VisualData {
        dataPoints: VisualDataPoint[];
        legendData: LegendData;
        hasHighlight: boolean;
        isLegendNeeded: boolean;
        size: ISize;
        axes: IAxes;
        categories: any[];
    }

    export interface IAxesSize {
        xAxisHeight: number;
        yAxisWidth: number;
    }

    export interface VisualMeasureMetadata {
        idx: VisualMeasureMetadataIndexes;
        cols: VisualMeasureMetadataColumns;
        labels: VisualAxesLabels;
        groupingColumn: DataViewMetadataColumn
    }

    export interface VisualMeasureMetadataIndexes {
        category?: number;
        value?: number;
        y?: number;
        gradient?: number;
    }

    export interface VisualMeasureMetadataColumns {
        value?: DataViewMetadataColumn;
        category?: DataViewMetadataColumn;
    }

    export interface VisualAxesLabels {
        x: string;
        y: string;
    }

    export interface LegendSize {
        width: number;
        height: number;
    }

    export interface VisualTranslation {
        x: number;
        y: number;
    }

    export interface CategoryDataPoints {
        categoryName: string;
        dataPoints: VisualDataPoint[];
    }

    export interface AxesDomains {
        yAxisDomain: number[];
        xAxisDomain: number[];
    }

    export enum ScrollableAxisName {
        X = <any>'x',
        Y = <any>'y'
    }

    export type SelectionState = undefined | null | 'selected' | 'justSelected' | 'justRemoved';
}



/*
 *  Power BI Visualizations
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

module powerbi.extensibility.visual {
  "use strict";
  import DataViewObjectsParser = powerbi.extensibility.utils.dataview.DataViewObjectsParser;

  const DefaultFontFamily: string = "\"Segoe UI\", wf_segoe-ui_normal, helvetica, arial, sans-serif";

  export class VisualSettings extends DataViewObjectsParser {
    public selectionSaveSettings = {
      selection: []
    };
    public dataPoint: dataPointSettings = new dataPointSettings();
    public smallMultiple: smallMultipleSettings = new smallMultipleSettings();
    public legend: legendSettings = new legendSettings();
    public categoryAxis: categoryAxisSettings = new categoryAxisSettings();
    public valueAxis: valueAxisSettings = new valueAxisSettings();
    public categoryLabels: categoryLabelsSettings = new categoryLabelsSettings();
    public constantLine: constantLineSettings = new constantLineSettings();
  }

  export enum LabelPosition {
    Auto = <any>"auto",
    InsideEnd = <any>"end",
    OutsideEnd = <any>"outside",
    InsideBase = <any>"base",
    InsideCenter = <any>"center"
  }

  export enum LabelOrientation {
    Vertical = <any>"vertical",
    Horizontal = <any>"horizontal"
  }

  // tslint:disable-next-line:class-name
  export class dataPointSettings {
    // Fill
    public fill: string = "#01b8aa";
    // Show all
    public showAllDataPoints: boolean = true;
  }

  export enum LineStyle {
    Dashed = <any>"dashed",
    Solid = <any>"solid",
    Dotted = <any>"dotted"
  }

  export enum Position {
    Behind = <any>"behind",
    InFront = <any>"front"
  }

  export enum Text {
    Name = <any>"name",
    Value = <any>"value",
    NameAndValue = <any>"nameAndValue"
  }

  export enum HorizontalPosition {
    Left = <any>"left",
    Right = <any>"right"
  }

  export enum VerticalPosition {
    Top = <any>"top",
    Bottom = <any>"bottom"
  }

  export enum LayoutMode {
    Flow = <any>"flow",
    Matrix = <any>"matrix"
  }

  // tslint:disable-next-line:class-name
  export class legendSettings {
    // Show legend
    public show: boolean = true;
    // Position
    public position: string = "Top";
    // Show title
    public showTitle: boolean = true;
    // Legend Name
    public legendName: string = "";
    // Legend Name Fill
    public legendNameColor: string = "";
    // Legend Font Family
    public fontFamily: string = DefaultFontFamily;
    // Legend Font Size
    public fontSize: number = 8;
  }
  // tslint:disable-next-line:class-name
  export class categoryAxisSettings {
    // Show category axis
    public show: boolean = true;
    // Position
    public position: string = "top";
    // Axis type
    public axisType: string = "categorical";
    // Axis Scale type
    public axisScale: string = "linear";
    // Axis start
    public start: number = null;
    // Axis end
    public end: number = null;
    // Axis color
    public axisColor: string = "";
    // Axis Font Size
    public fontSize: number = 11;
    // Axis Font Family
    public fontFamily: string = DefaultFontFamily;
    // Display Units
    public displayUnits: number = 0;
    // valueDecimalPlaces
    public precision: number = null;
    // Minimum category width
    public minCategoryWidth: number = 20;
    // Minimum category width
    public maximumSize: number = 25;
    // Minimum category width
    public innerPadding: number = 20;
    // Show title
    public showTitle: boolean = false;

    public titleStyle: string = "showTitleOnly";
    public axisTitleColor: string = "";
    public axisTitle: string = "";
    public titleFontSize: number = 11;
    public titleFontFamily: string = DefaultFontFamily;
  }
  // tslint:disable-next-line:class-name
  export class valueAxisSettings {
    // Show category axis
    public show: boolean = true;
    // Position
    public position: string = "left";
    // Axis Scale type
    public axisScale: string = "linear";
    // Axis start
    public start: number = null;
    // Axis end
    public end: number = null;
    // Axis color
    public axisColor: string = "";
    // Axis Font Size
    public fontSize: number = 11;
    // Axis Font Family
    public fontFamily: string = DefaultFontFamily;
    // Display Units
    public displayUnits: number = 0;
    // valueDecimalPlaces
    public precision: number = null;
    // Show Title
    public showTitle: boolean = false;

    public titleStyle: string = "showTitleOnly";
    public axisTitleColor: string = "";
    public axisTitle: string = "";
    public titleFontSize: number = 11;
    public titleFontFamily: string = DefaultFontFamily;
    // Show Gridlines
    public showGridlines: boolean = true;

    public gridlinesColor: string = "";
    public strokeWidth: number = 1;
    public lineStyle: string = "solid";
  }
  // tslint:disable-next-line:class-name
  export class categoryLabelsSettings {
    // Show category axis
    public show: boolean = false;
    // Axis color
    public color: string = "";
    // Display Units
    public displayUnits: number = 0;
    // Value decimal places
    public precision: number = 0;
    public orientation: LabelOrientation = LabelOrientation.Horizontal;
    // Category labels position
    public labelPosition: LabelPosition = LabelPosition.Auto;
    // Category labels position
    public labelPositionForFilledLegend: LabelPosition = LabelPosition.Auto;
    // Overflow text
    public overflowText: boolean = false;
    // Axis Font Size
    public fontSize: number = 9;
    // Axis Font Family
    public fontFamily: string = DefaultFontFamily;
    // Show Background
    public showBackground: boolean = false;
    // Show Background transparency
    public transparency: number = 90;
    // Show Background transparency
    public backgroundColor: string = "";
  }
  
  export class constantLineSettings {
    public show: boolean = false;
    public name: string = "";
    public value: number = 0;
    public lineColor: string = "#01b8aa";
    public transparency: number = 90;
    public lineStyle: LineStyle = LineStyle.Dotted;
    public position: Position = Position.Behind;
    public dataLabelShow: boolean = false;    
    public fontColor: string = "#01b8aa";
    public text: Text = Text.Name;
    public horizontalPosition: HorizontalPosition = HorizontalPosition.Left;
    public verticalPosition: VerticalPosition = VerticalPosition.Top;
    public displayUnits: number = 0;
    public precision: number = null;
  }

  export class smallMultipleSettings {
    public layoutMode: LayoutMode = LayoutMode.Flow;
    public minUnitWidth: number = 150;
    public minUnitHeight: number = 120;
    public maxRowWidth: number = 4;
    public showChartTitle: boolean = true;
    public textcolor: string = "#000000";
    public fontFamily: string = DefaultFontFamily;
    public fontSize: number = 9;
    public fontColor: string = "#000000";
    public showSeparators: boolean = true;
  }
}

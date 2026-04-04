declare module 'dxf-writer' {
  class DxfWriter {
    static ACI: {
      BLACK: number;
      RED: number;
      CYAN: number;
      GREEN: number;
      GRAY: number;
      WHITE: number;
    };
    addLayer(name: string, color: number, lineType: string): this;
    setActiveLayer(name: string): this;
    drawLine(x1: number, y1: number, x2: number, y2: number): this;
    drawRect(x1: number, y1: number, x2: number, y2: number): this;
    drawCircle(cx: number, cy: number, radius: number): this;
    drawText(x: number, y: number, height: number, angle: number, text: string): this;
    toDxfString(): string;
  }
  export = DxfWriter;
}

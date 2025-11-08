export type PrimitiveReference = {
  name: string;
  title: string;
  description: string;
  example: string;
};

export const PRIMITIVE_REFERENCE: PrimitiveReference[] = [
  {
    name: 'line',
    title: 'Line',
    description: 'Draw a straight segment between two points.',
    example: `{
  type:'line',
  data:{
    from:[-5,0],
    to:[5,0],
    stroke:'#38bdf8',
    width:0.35,
    dash:[1,0.5]
  }
}`
  },
  {
    name: 'rect',
    title: 'Rectangle',
    description: 'Filled or stroked axis-aligned rectangle.',
    example: `{
  type:'rect',
  data:{
    position:[-4,-2],
    size:[8,4],
    fill:'rgba(56,189,248,0.25)',
    stroke:'#38bdf8',
    width:0.4
  }
}`
  },
  {
    name: 'circle',
    title: 'Circle',
    description: 'Circle defined by center and radius.',
    example: `{
  type:'circle',
  data:{
    center:[2,-1],
    radius:3,
    stroke:'#f97316',
    fill:'rgba(249,115,22,0.25)',
    width:0.35
  }
}`
  },
  {
    name: 'polygon',
    title: 'Polygon',
    description: 'Closed shape from three or more points.',
    example: `{
  type:'polygon',
  data:{
    points:[[-6,-2],[-2,4],[4,3],[6,-1]],
    fill:'rgba(94,234,212,0.25)',
    stroke:'#0ea5e9',
    width:0.3
  }
}`
  },
  {
    name: 'text',
    title: 'Text',
    description: 'Label rendered at a point using world coordinates.',
    example: `{
  type:'text',
  data:{
    position:[0,6],
    text:'Hello',
    color:'#e2e8f0',
    fontSize:1.6,
    align:'center'
  }
}`
  }
];

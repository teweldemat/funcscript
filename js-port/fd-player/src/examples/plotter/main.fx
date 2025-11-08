{
    // function definition for the curve: f(x) = x³ - 2x² + 1
    // experiment with different equations
    f:(x)=>1.0/3*x*x*x - 2*x*x + 1;

    // number of points and x-axis range
    n:500;
    x1:-10.0;
    x2:10.0;

    yMin:view.minY;
    yMax:view.maxY;

    // generate (x, f(x)) pairs
    data:range(0,n) map (i)=>{
        x:x1 + (x2 - x1) * i / n;
        return [x,f(x)];
    };

    // x-axis styled as a green line
    xAxis:{type:'line',data:{from:[x1,0],to:[x2,0],stroke:'#22c55e',width:0.28}};

    // y-axis styled as a green line
    yAxis:{type:'line',data:{from:[0,yMin],to:[0,yMax],stroke:'#22c55e',width:0.28}};


    // draw the curve as connected line segments
    curve:range(0,n-1) map (i)=>{
        type:'line',data:{from:data[i],to:data[i+1],stroke:'#38bdf8',width:0.2}
    };

    // return elements to render
    return [xAxis,yAxis,curve];
}
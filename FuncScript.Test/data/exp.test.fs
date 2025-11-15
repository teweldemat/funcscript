{ 
    suite: { 
        name: "is test"; 
        cases: [{x:-1},{x:1}]; 
        test: (result, data) => assert.equal(result, -math.abs(data.x))
    }; 
    eval [suite]; 
}

# Known FuncScript issue

1. ## string interpolation issue
y:{x:5};
eval "test {y}

works if eval "test {format(y)}"

2. ## Expression function cloning expression excessive for dealing with closure issue

3. ## TODO: test expression functions interaction with the KVC context it is defined in. Include the case when they are used as annoymous lamdba expression

4. ## TODO: change to FSError from throwing excpetion in C# version with code location feature retained

5. ## TODO: extensive test of evalution of paramters when they called rule eg. false and a.b will not evaluate 'a.b' part

6. ## operator ?? should take infinite arguments a??b??c??d

7. ## study ?? ?. ?! precedence

8. ## json parity fuzz test
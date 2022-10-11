const esprima = require('esprima')
const util = require('util')
const parsed = esprima.parseScript(process.argv[2])
const fail = msg => { console.error(msg); process.exit(1) }

if (parsed.body.length > 1) {
	fail('multiple expressions found')
}
if (parsed.body[0].type !== 'ExpressionStatement') {
	fail('not ExpressionStatement: ' + parsed.body[0].type)
}

const func = parsed.body[0].expression
if (func.type !== 'ArrowFunctionExpression') {
	fail('not arrow function: ' + parsed.body[0].expression.type)	
} 
if (func.params.length > 1) {
	fail('function should accept only one parameter')
}
if (func.params[0].type !== 'Identifier') {
	fail('function parameter shouldn\'t be destructuring')
}
if (func.async) {
	fail('function should be synchronous')
}

const inputName = func.params[0].name

function parseExpr(context, expr) {
	// console.log('%o', expr)
	switch (expr.type) {
		case 'CallExpression':
			switch (expr.callee.type) {
				case 'MemberExpression':
				// method call
					const methodName = expr.callee.property.name
					const callee = parseExpr(context, expr.callee.object)
					switch (methodName) {
						case 'filter':
						case 'map':
							if (expr.arguments.length !== 1) {
								fail('Array.prototype.' + methodName + ' accepts exactly 1 parameter')
							}
							const predicate = expr.arguments[0]
							if (predicate.type !== 'ArrowFunctionExpression') {
								fail('Array.prototype.' + methodName + ' predicate must an arrow function')
							}
							if (predicate.params.length < 1) {
								fail('Array.prototype.' + methodName + ' predicate must have at least 1 parameter')
							}
							const itemName = predicate.params[0].name
							if (methodName === 'filter') {
								return callee + ' | map(select(' + parseExpr(itemName, predicate.body) + '))'
							} else {
								return callee + ' | map(' + parseExpr(itemName, predicate.body) + ')'
							}
						case 'slice':
							return callee + `[${expr.arguments[0]?.value ?? ''}:${expr.arguments[1]?.value ?? ''}]`
						default:
							fail('unrecognized method: ' + methodName)
					}
					break
				default:
					fail('unrecognized callee: ' + util.inspect(expr.callee))
			}
			break
		case 'MemberExpression':
			const object = parseExpr(context, expr.object)
			if (expr.computed) {
				// object['property']
				return object + `[${parseExpr(context, expr.property)}]`
			} else {
				// object.property
				return object + '.' + expr.property.name
			}
			break
		case 'Identifier':
			if (expr.name === context) {
				return ''
			}
			return expr.name
		case 'BinaryExpression':
			var left = parseExpr(context, expr.left)
			var right = parseExpr(context, expr.right)
			switch (expr.operator) {
				case '<':
					return left + ' < ' + right
				case '>':
					return left + ' > ' + right
				case '==':
					return left + ' == ' + right
				case '===':
					return left + ' == ' + right
				case '!=':
					return left + ' != ' + right
				case '!==':
					return left + ' != ' + right
				default:
					fail('unrecognized binary operator: ' + expr.operator)
			}
		case 'LogicalExpression':
			var left = parseExpr(context, expr.left)
			var right = parseExpr(context, expr.right)
			switch (expr.operator) {
				case '&&':
					return left + ' and ' + right
				case '||':
					return left + ' and ' + right
				default:
					fail('unrecognized logical operator: ' + expr.operator)
			}
		case 'Literal':
			return expr.raw
		default:
			console.log('%o', expr)
			fail('unrecognized expression: ' + expr.type)
	}
}

console.log('.' + parseExpr(inputName, func.body))

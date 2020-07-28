# Objective

Implement a program that approves/declines attempts to load funds into customers' accounts

## Sample Input
```json
{
  "id": "0",
  "customer_id": "0",
  "load_amount": "$1000.01",
  "time": "2028-01-01T20:20:01Z"
}
```
## Sample output
```json
{ "id": "0", "customer_id": "0", "accepted": true }
```

Customer has the following restriction:
- Max of 5,000 / day
- 3 loads / day, regardless of amount
- Max of 20,000 / week

Other rules:
- Load inputs arrive in ascending chronological order
- Ignore all repeated load ids if it's been seen before a particular user
- Start of day is midnight UTC
- Start of week is Monday

# Initial Setup
`npm install`

# Execution
## With default params
`npm start`

## With params
`npm start -- --input i.txt --ouput o.txt`

## Params
- `--input, -i` : output file path (default: `"input.txt"`)
- `--output, -o` : output file path (default: `"output.txt"`)
- `--debug, -d` : print debug messages (default: `false`)

# Clean
`npm run clean`

# Test
`npm test`

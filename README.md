# 🤖 kitchen-robot 🤖

A friendly bot to run the Oven and sanity checks inside pies.

### How to run

```
yarn 
yarn start
```

### Commands

```
KitchenBot$ help

  Commands:

    help [command...]           Provides help for a given command.
    exit                        Exits application.
    oven-state                  Outputs state of the ovens.
    oven-stop-checks            Stops checking the oven.
    oven-start-checks           Start checking the oven.
    oven-run-checks [options]   Runs checks on the oven now.
    
    
KitchenBot$ help oven-run-checks

  Usage: oven-run-checks [options]

  Runs checks on the oven now.

  Options:

    --help       output usage information
    -no, --notx  Runs checks on the oven without exectuting the tx    
```

### How to run for development

```
yarn 
yarn start:dev
```

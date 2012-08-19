var fs = require('fs');
var Step = require('step');
var aws = require('aws-lib');
var _ = require('underscore');
var optimist = require('optimist')
.usage('TODO\n' +
       'Usage: $0 [options]\n\n' +
       '  TODO')
.alias('region', 'r')
.default('region', 'us-east-1');
var argv = optimist.argv;
var options = {};
// Setup configuration options
if (argv.config) {
    try {
        _(JSON.parse(fs.readFileSync(argv.config, 'utf8'))).each(function(v, k) {
            options[k] = v;
        });
    } catch(e) {
        console.warn('Invalid JSON config file: ' + argv.config);
       throw e;
    }
}
// Allow options command-line overrides
_.each(argv, function(v, k) {
    options[k] = argv[k];
});

if (!options.awskey ||
    !options.awssecret) {
    console.log("Must provide all of awskey and awssecret as --config parameters")
    process.exit(1);
}

var cw = aws.createCWClient(options.awskey, options.awssecret,
    {host: 'monitoring.' + options.region + '.amazonaws.com'});
var ec2 = aws.createEC2Client(options.awskey, options.awssecret,
    {host: 'ec2.' + options.region + '.amazonaws.com', version: '2012-03-01'});

Step(
    function() {
        exec('wget -q -O - http://169.254.169.254/latest/meta-data/instance-id', this);
    },
    function(err, instanceId) {
        options.instanceId = instanceId;
        if (err) throw err;
        ec2.call('DescribeTags', {
            'Filter.1.Name': 'resource-id',
            'Filter.1.Value': instanceId,
            'Filter.2.Name': 'key',
            'Filter.2.Value': options.instanceNameTag
        }, this);
    },
    function(err, result) {
        if (err) throw err;
        else if (result && result.Error)
          throw JSON.stringify(result.Error);
        if (!result.tagSet.item) return '';
        else return result.tagSet.item.key === 'Name' ? result.tagSet.item.value : '';
    },
    function(err, name) {
        if (err) throw err;
        options.name = name;
        var Metrics = require('./lib/Metrics.js')(options);
        _(options.metrics).each(function(metric) {
            var reporter = new Metrics(metric);
        });
    }
);


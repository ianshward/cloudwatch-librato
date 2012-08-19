var aws = require('aws-lib');
var _ = require('underscore');
var Librato = require('librato-metrics');

module.exports = function(options) {

    var cw = aws.createCWClient(options.awskey, options.awssecret,
    {host: 'monitoring.' + options.region + '.amazonaws.com'});

    var librato = Librato.createClient({
        email: options.libratoEmail,
        token: options.libratoToken
    });

    var Metrics = function(metric) {
        var that = this;
        setInterval(function() { that.emit('metrics'); }, parseInt(metric.Period, 10) * 100);
        this.on('metrics', function() {
            that.fetch(metric, function(err, results) {
                if (err) throw err;
                that.submit(metric, results);
            });
        }); 
    };

    Metrics.prototype = new process.EventEmitter();

    Metrics.prototype.fetch = function(metric, cb) {
        cw.call('GetMetricStatistics', {
            MetricName: metric.MetricName,
            Namespace: metric.Namespace,
            'Dimensions.member.1.Name': 'InstanceId',
            'Dimensions.member.1.Value': options.instanceId, // TODO instanceId hardcoded
            'StartTime': new Date(new Date().getTime() - 120000).toISOString(),
            'EndTime': new Date(new Date().getTime() - 60000).toISOString(),
            'Period': metric.Period,
            'Unit': metric.Unit,
            'Statistics.member.1': metric.Statistic
            }, function(err, res) {
                if (err) throw err;
                cb(err, res);
            });
    }

    Metrics.prototype.submit = function(metric, results) {
        // Assumes one data point.
        var data = results.GetMetricStatisticsResult.Datapoints.member;
        var payload = {
            name: results.GetMetricStatisticsResult.Label,
            value: data.Average || null, // TODO: not always set, chokes.
            source: options.name.replace(/(\s|-)/g,'_'), // TODO spaces in name choke
            measure_time: new Date(data.Timestamp).getTime() / 1000
        }
        if (payload.name && payload.value) {
            console.log(JSON.stringify({guages: [payload]}));
            librato.post('/metrics', {
                gauges: [payload]
            }, function(err, response) {
               if (err) throw err;
               console.log(response);
           });
        }
    }

    return Metrics;
}

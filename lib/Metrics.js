var aws = require('aws-lib');
var Step = require('step');
var _ = require('underscore');
var Librato = require('librato-metrics');

module.exports = function(options) {

    var cw = aws.createCWClient(options.awskey, options.awssecret,
    {host: 'monitoring.' + options.region + '.amazonaws.com'});

    var librato = Librato.createClient({
        email: options.libratoEmail,
        token: options.libratoToken
    });

    var Metrics = function(batch) {
        var that = this;
        setInterval(function() { that.emit('metrics'); }, parseInt(batch[0].Period, 10) * 1000);
        this.on('metrics', function() {
            that.fetch(batch, function(results) {
                that.submit(results);
            });
        }); 
    };

    Metrics.prototype = new process.EventEmitter();

    Metrics.prototype.fetch = function(batch, cb) {
        Step(
            function() {
                var group = this.group();
                _(batch).each(function(metric) {
                    cw.call('GetMetricStatistics', {
                        MetricName: metric.MetricName,
                        Namespace: metric.Namespace,
                        'Dimensions.member.1.Name': 'InstanceId',
                        'Dimensions.member.1.Value': options.instanceId,
                        'StartTime': new Date(new Date().getTime() - 120000).toISOString(),
                        'EndTime': new Date(new Date().getTime() - 60000).toISOString(),
                        'Period': metric.Period,
                        'Unit': metric.Unit,
                        'Statistics.member.1': metric.Statistic
                    }, group());
                });
             },
             function(err, results) {
                 if (err) throw err;
                 cb(results);
             }
        );
    }

    Metrics.prototype.submit = function(results) {
        var payload = [];
        _(results).each(function(result, i) {
            var data = result.GetMetricStatisticsResult.Datapoints.member;
            payload[i] = {
                name: result.GetMetricStatisticsResult.Label,
                value: data.Average || null, // TODO: not always set, chokes.
                source: options.name.replace(/(\s|-)/g,'_'), // TODO spaces in name choke
                measure_time: new Date(data.Timestamp).getTime() / 1000
            };
        });
        librato.post('/metrics', {
            gauges: payload
        }, function(err, response) {
           if (err) throw err;
           console.log(response);
        });
    }

    return Metrics;
}

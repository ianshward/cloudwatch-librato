### Overview

cloudwatch-librato allows you to query your [Amazon CloudWatch](http://aws.amazon.com/cloudwatch/) metrics and submit them to [Librato Metrics](https://metrics.librato.com/). Librato Metrics has powerful metric correlation, metric drilldown, and custom dashboards features which let you view related metrics together in the same graph or on the same custom dashboard.  If you have metrics in more than one AWS region it is easy to view them side by side within Librato Metrics.

### Setup

cloudwatch-librato runs as a daemon.  A configuration file holds AWS and Librato API credentials as well as definitions of which metrics to fetch from CloudWatch and send to Librato.  There are four ways you can specify "Dimensions" for a metric:

**Non-instance dimensions**

```json
{
    "MetricName": "Latency",
    "Namespace": "AWS/ELB",
    "Unit": "Count",
    "Period": 60,
    "Statistic": "Sum",
    "Dimensions": {
        "us-east-1": [
                         ["LoadBalancerName", "my-ui-load-balancer", "VA_UI_ELB"],
                         ["LoadBalancerName", "my-api-load-balancer", "VA_API_ELB"]
                     ],
        "eu-west-1": [
                         ["LoadBalancerName", "my-ui-load-balancer", "IRL_UI_ELB"],
                         ["LoadBalancerName", "my-api-load-balancer", "IRL_API_ELB"]
                     ]
    }
}
```

- LoadBalancerName is the dimension Name
- my-ui-load-balancer is the dimension Value
- The third element can be anything, it's used as the source name

**Instance dimensions**

```json
{
    "MetricName": "CPUUtilization",
    "Namespace": "AWS/EC2",
    "Unit": "Percent",
    "Period": 60,
    "Statistic": "Average",
    "Dimensions": {
        "us-east-1": "_callback",
        "eu-west-1": "_callback"
    }
}
```
- _callback will cause a file called "./getInstances" to be executed, which should return a space or line separated list of ec2 instanceid's. The region id is passed to this file as an argument like: `./getInstances us-east-1`

**This instance**

```json
{
    "MetricName": "NetworkOut",
    "Namespace": "AWS/EC2",
    "Unit": "Bytes",
    "Period": 300,
    "Statistic": "Average",
    "Dimensions": "_self"
}
```

- use of _self will cause a file called ./self to be executed.  The output of ./self should return an instanceId, like `i-abcd1234`. The idea is the instance where the daemon is running will be used as the source, so you could create the ./self file and set its contents to:

```bash
#!/bin/bash

wget -q -O - http://169.254.169.254/latest/meta-data/instance-id
```

See settings.example.json for more examples.

**Other values in settings.example.json**

* **instanceNameTag** if you use the ec2 "tags" feature and one of your tags refers to a name you've given that ec2, you can set the value of this key to the name of that tag, which will give your metrics friendlier names within Librato Metrics.

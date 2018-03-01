# cointoss

[![Code Status](https://img.shields.io/badge/Code-Pre--Alpha-orange.svg)](https://github.com/Holochain/cointoss#feature-roadmap-and-current-progress)
[![In Progress](https://img.shields.io/waffle/label/Holochain/cointoss/in%20progress.svg)](http://waffle.io/Holochain/cointoss)
[![Gitter](https://badges.gitter.im/metacurrency/holochain.svg)](https://gitter.im/metacurrency/holochain?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=body_badge)
[![License: GPL v3](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](http://www.gnu.org/licenses/gpl-3.0)

**holochain example for "trustable random initiation"n**
This application demonstrates an algorithmic pattern for "trustable random initiation" in a distributed environment, i.e. how pick white/black for chess, or how we do rock/paper/scissors.

**[Code Status:](https://github.com/metacurrency/holochain/milestones?direction=asc&sort=completeness&state=all)** This is a demonstration application only.


## Theory

In a distributed system, we want to be able to begin an interaction in a random fashion, i.e. have a coin toss as to who gets white for a chess game.  In a distributed system, we must come up with a solution whereby the randomness available to the two parties is combined in a way that both parties can trust that the other party can't control or predict the outcome ahead of time and thus win the coin toss.

The cointoss app achieves this in the following way:

1) Alice requests of Bob to toss a coin by committing a `seed` with the following data:
- salt: a random salt string
- seedValue: a randomly chosen number between 0 and 9
to her private chain, and then sending to Bob a hash of that seed via node-to-node communication.

2) When Bob receives the request, Bob similarly commits his own `seed` with the same structure as above, and then commits a `toss` with the following data:
- initiator: in this case Alice
- initiatorSeedHash: the hash of the seed that Alice sent Bob
- responder: in this case Bob
- responderSeedHash: the hash of Bob's seed
- call: a random 1, or 0 equivalent to choosing heads or tails

after making those two commits Bob responds to Alice's request with the a triple: (responderSeed,tossHash,call)

3) When Alice receives the response from Bob, she now commits a `toss` on her chain because she now has all the same information necessary to commit that value.

4) At this point the actual coin toss has been completed because both parties have an entry that hashes to the same value on their chains.  The winner of the is defined as follows: the responder wins if (initiator.seedValue+responder.seedValue) % 2 == call).  This is meant to mimic the way the "initiator" flips a coin, but the responder makes the call.

The trick behind this process is that before step 3 is completed, both parties keep their seed information secret, after the two parties both have received confirmation that the other party has committed the toss to their own chain in the form of the signed toss, then they can make their seeds content public to anybody who asks.  This is because after the toss has been independently committed to both chains, the two parties can't go back on their own contribution to the randomness that makes up the toss, nor can they predict the whether the other party choose an odd or even value for their random seed by examining the hash of the seed because that seed contains a long random salt, making it impractical to search the seed space to try and brute force the generation of a seed to match its hash.

## License
GPL 3.0 License.

## Installation

Prerequiste: [Install holochain](https://github.com/metacurrency/holochain/#installation) on your machine.
You can install cointoss very simply with this:

``` shell
hcdev init -cloneExample=cointoss

```

## Usage

To do a test run of cointoss simply type

``` shell
cd cointoss
hcdev web
```
you should see something like:

``` shell
Copying chain to: /home/bootstrap/.holochaindev
...
Serving holochain with DNA hash:QmZYxoxcqgCp6Xf6xVe8ptzPkmH8QMzxqp4r49QYpS2fEF on port:4141
```
Then simply point your browser to http://localhost:4141 access the cointoss UI.

### Tests
To run all the stand alone tests:

``` shell
hcdev test
```

#### play
``` shell
hcdev scenario play
```
This test spins up two nodes `jane` and `joe` and tests that they can do a cointoss together. To watch the network traffic and details try:

``` shell
hcdev -debug scenario play
```
#### stress

This test is designed to be run a test which spins up a bunch clone nodes that all do a cointoss with jane.

## Feature Roadmap and Current Progress

TODO


## Contribute
We welcome pull requests and issue tickets.  Find us on [gitter](https://gitter.im/metacurrency/holochain) to chat.

Contributors to this project are expected to follow our [development protocols & practices](https://github.com/metacurrency/holochain/wiki/Development-Protocols).

## License
[![License: GPL v3](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](http://www.gnu.org/licenses/gpl-3.0)

Copyright (C) 2017, The MetaCurrency Project (Eric Harris-Braun, Arthur Brock, et. al.)

This program is free software: you can redistribute it and/or modify it under the terms of the license provided in the LICENSE file (GPLv3).  This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.

**Note:** We are considering other 'looser' licensing options (like MIT license) but at this stage are using GPL while we're getting the matter sorted out.

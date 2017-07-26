# cointoss - holochain example for "trustable random initiation"

This application demonstrates an algorithmic pattern for "trustable random initiation" in a distributed environment, i.e. how pick white/black for chess, or how we do rock/paper/scissors.

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

The trick behind this process is that before step 3 is completed, both parties keep their seed information secret, after the two parties both have received confirmation that the other party has committed the toss their own chain in the form of the signed toss, then they can make their seeds content public to anybody who asks.  This is because after the toss has been independently committed to both chains, the two parties can't go back on their own contribution to the randomness that makes up the toss, nor can they predict the whether the other party choose an odd or even value for their random seed by examining they hash of the seed because that seed contains a long random salt, making it impractical to search the seed space to try and brute force the generation of a seed to match its hash.

## License
GPL 3.0 License.

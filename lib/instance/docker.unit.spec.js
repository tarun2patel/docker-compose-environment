'use strict';
const chai       = require('chai'),
      expect     = chai.expect,
      proxyquire = require('proxyquire').noCallThru(),
      sinon      = require('sinon'),
      sinonChai  = require('sinon-chai'),
      Q          = require('q'),
      dockerStub = require('../../../../stubs/index').docker;
chai.use(sinonChai);

describe('Container tests: ', ()=> {
    let dockerContainer;
    before(() => {

        const ProxyDockerContainer = proxyquire('./docker', {
            '../../../../docker': dockerStub({
                getContainer: function () {},
                noSpecificNode: true
            })
        });

        dockerContainer           = new ProxyDockerContainer({});
        dockerContainer.container = {
            inspect: sinon.spy(() => {return Q.resolve('done');})
        };

        dockerContainer.unpause = sinon.spy(() => {
            return Q.resolve('unpaused');
        });
    });

    describe('Positive tests: ', () => {

        before(() => {
            dockerContainer.terminate = sinon.spy(() => {
                return dockerContainer.getStatus()
                    .then(status => {
                        if (/pause/.test(status)) {
                            return dockerContainer.unpause();
                        }
                        return Q.resolve();
                    })
                    .then(() => {
                        return Q.resolve('terminated');
                    });

            });
        });

        beforeEach(() => {
            dockerContainer.getStatus = sinon.spy();
            dockerContainer.getStatus.reset();
            dockerContainer.terminate.reset();
            dockerContainer.unpause.reset();
        });

        it('Should terminate puaused container by unpausing it first', () => {
            dockerContainer.getStatus = sinon.spy(() => {return Q.resolve('pause');});
            expect(dockerContainer).to.exist();
            return dockerContainer.terminate()
                .then(status => {
                    expect(status).to.be.equal('terminated');
                    expect(dockerContainer.getStatus).to.have.been.calledOnce; // jshint ignore:line
                    expect(dockerContainer.terminate).to.have.been.calledOnce; // jshint ignore:line
                    expect(dockerContainer.unpause).to.have.been.calledOnce; // jshint ignore:line
                });
        });

        it('Should terminate running container', () => {
            dockerContainer.getStatus = sinon.spy(() => {
                return Q.resolve('start');
            });
            expect(dockerContainer).to.exist();
            return dockerContainer.terminate()
                .then(status => {
                    expect(status).to.be.equal('terminated');
                    expect(dockerContainer.getStatus).to.have.been.calledOnce; // jshint ignore:line
                    expect(dockerContainer.terminate).to.have.been.calledOnce; // jshint ignore:line
                    expect(dockerContainer.unpause).to.have.been.callCount(0);
                });
        });
    });

    describe('Negative tests: ', () => {

        before(() => {
            dockerContainer.terminate = sinon.spy(() => {
                return Q.reject(new Error('Termination error'));
            });
        });

        beforeEach(() => {
            dockerContainer.terminate.reset();
        });

        it('Should raise error on termination failed', () => {
            return dockerContainer.terminate()
                .catch(err => {
                    expect(dockerContainer.terminate).to.have.been.calledOnce; // jshint ignore:line
                    expect(err.message).to.be.equal('Termination error');
                });
        });
    });
});

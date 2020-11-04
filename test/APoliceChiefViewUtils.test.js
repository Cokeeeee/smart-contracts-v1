const { expectRevert, time } = require('@openzeppelin/test-helpers');
const CokeToken = artifacts.require('CokeToken');
const PoliceChief = artifacts.require('PoliceChief');
const MockERC20 = artifacts.require('MockERC20');
const {BigNumber} = require('@ethersproject/bignumber');

contract('PoliceChief', ([_, cokeDeployerAddress, policeChiefDeployerAddress, devFundAddress, minterAddress, user1Address, user2Address]) => {
    beforeEach(async () => {
        this.cokeToken = await CokeToken.new({ from: cokeDeployerAddress });
        this.defaultBurnDivisor = 100 // 1% burn, changing this will break the tests
        await this.cokeToken.setBurnDivisor(this.defaultBurnDivisor, {from: cokeDeployerAddress})
        this.defaultCokePerBlock = '100000000000000000000' // 100 coke
    });

    it('cokeBalancePendingHarvest', async () => {
        this.policeChief = await PoliceChief.new(this.cokeToken.address, devFundAddress, this.defaultCokePerBlock, '0', '0', { from: policeChiefDeployerAddress });
        await this.cokeToken.transferOwnership(this.policeChief.address, {from: cokeDeployerAddress})
        await this.policeChief.setDivisors(this.defaultBurnDivisor, this.defaultBurnDivisor, this.defaultBurnDivisor, { from: policeChiefDeployerAddress })

        // add 3 pools
        this.lp = await MockERC20.new('LPToken', 'LP', '10000000000', { from: minterAddress });
        await this.policeChief.add('100', this.lp.address, true, { from: policeChiefDeployerAddress })
        this.lp2 = await MockERC20.new('LPToken2', 'LP2', '10000000000', { from: minterAddress });
        await this.policeChief.add('100', this.lp2.address, true, { from: policeChiefDeployerAddress })
        this.lp3 = await MockERC20.new('LPToken3', 'LP3', '10000000000', { from: minterAddress });
        await this.policeChief.add('100', this.lp3.address, true, { from: policeChiefDeployerAddress })

        // deposit in 3 pools
        await this.lp.approve(this.policeChief.address, '100', { from: minterAddress })
        await this.policeChief.deposit('0', '100', { from: minterAddress })
        await this.lp2.approve(this.policeChief.address, '100', { from: minterAddress })
        await this.policeChief.deposit('1', '100', { from: minterAddress })
        await this.lp3.approve(this.policeChief.address, '100', { from: minterAddress })
        await this.policeChief.deposit('2', '100', { from: minterAddress })

        let pendingHarvestBefore, pendingHarvestAfter
        
        // try once
        pendingHarvestBefore = (await this.policeChief.cokeBalancePendingHarvest(minterAddress)).toString()
        await time.advanceBlock() // advance 1 block to see if pending updated correctly
        pendingHarvestAfter = (await this.policeChief.cokeBalancePendingHarvest(minterAddress)).toString()
        // user's pending balance has increased by 100% of the coke per block because he's the only staker
        assert.equal(BigNumber.from(pendingHarvestAfter).sub(BigNumber.from(pendingHarvestBefore)).toString(), this.defaultCokePerBlock)
    
        // try twice
        pendingHarvestBefore = (await this.policeChief.cokeBalancePendingHarvest(minterAddress)).toString()
        await time.advanceBlock() // advance 1 block to see if pending updated correctly
        pendingHarvestAfter = (await this.policeChief.cokeBalancePendingHarvest(minterAddress)).toString()
        // user's pending balance has increased by 100% of the coke per block because he's the only staker
        assert.equal(BigNumber.from(pendingHarvestAfter).sub(BigNumber.from(pendingHarvestBefore)).toString(), this.defaultCokePerBlock)

        // check balance all and pending harvest should be the same
        assert.equal((await this.policeChief.cokeBalanceAll(minterAddress)).toString(), (await this.policeChief.cokeBalancePendingHarvest(minterAddress)).toString())
        // balance + pending harvest should equal balance all after harvest
        await this.policeChief.deposit('0', '0', { from: minterAddress })
        let balancePlusPendingHarvest = (await this.cokeToken.balanceOf(minterAddress)).add(await this.policeChief.cokeBalancePendingHarvest(minterAddress))
        assert.equal((await this.policeChief.cokeBalanceAll(minterAddress)).toString(), balancePlusPendingHarvest.toString())
    
        // should still be true after a few blocks
        await time.advanceBlock()
        await time.advanceBlock()
        await time.advanceBlock()
        balancePlusPendingHarvest = (await this.cokeToken.balanceOf(minterAddress)).add(await this.policeChief.cokeBalancePendingHarvest(minterAddress))
        assert.equal((await this.policeChief.cokeBalanceAll(minterAddress)).toString(), balancePlusPendingHarvest.toString())
    })

    it('cokeBalanceStaked', async () => {
        // add 2 coke LPs (they own COKE) and 1 non-coke LP
        this.cokeLp = await MockERC20.new('LPToken', 'LP', '1000', { from: minterAddress });
        await this.cokeToken.mint(this.cokeLp.address, '100', {from: cokeDeployerAddress})
        this.cokeLp2 = await MockERC20.new('LPToken2', 'LP2', '1000', { from: minterAddress });
        await this.cokeToken.mint(this.cokeLp2.address, '100', {from: cokeDeployerAddress})
        this.nonCokeLp = await MockERC20.new('LPToken3', 'LP3', '1000', { from: minterAddress });

        const cokePerBlock = '1'
        this.policeChief = await PoliceChief.new(this.cokeToken.address, devFundAddress, cokePerBlock, '0', '0', { from: policeChiefDeployerAddress });
        await this.cokeToken.transferOwnership(this.policeChief.address, {from: cokeDeployerAddress})
        await this.policeChief.setDivisors(this.defaultBurnDivisor, this.defaultBurnDivisor, this.defaultBurnDivisor, { from: policeChiefDeployerAddress })

        // add 3 pools
        await this.policeChief.add('100', this.cokeLp.address, true, { from: policeChiefDeployerAddress })    
        await this.policeChief.add('100', this.cokeLp2.address, true, { from: policeChiefDeployerAddress }) 
        await this.policeChief.add('100', this.nonCokeLp.address, true, { from: policeChiefDeployerAddress })

        // user hasn't staked yet
        assert.equal((await this.policeChief.cokeBalanceStaked(minterAddress)).toString(), '0')

        // deposit in cokeLp
        await this.cokeLp.approve(this.policeChief.address, '100', { from: minterAddress })
        await this.policeChief.deposit('0', '100', { from: minterAddress })
        // user owns 100 out of 1000 cokeLp tokens, so 10% of the 100 COKE owned by the LP
        assert.equal((await this.cokeToken.balanceOf(this.cokeLp.address)).toString(), '100')
        assert.equal((await this.policeChief.cokeBalanceStaked(minterAddress)).toString(), '10')

        // deposit in nonCokeLp
        await this.nonCokeLp.approve(this.policeChief.address, '100', { from: minterAddress })
        await this.policeChief.deposit('2', '100', { from: minterAddress })
        // user owns 100 out of 1000 cokeLp tokens, so 10% of the 0 COKE owned by the LP, so still only 10
        assert.equal((await this.cokeToken.balanceOf(this.nonCokeLp.address)).toString(), '0')
        assert.equal((await this.policeChief.cokeBalanceStaked(minterAddress)).toString(), '10')

        // deposit in cokeLp 2
        await this.cokeLp2.approve(this.policeChief.address, '100', { from: minterAddress })
        await this.policeChief.deposit('1', '100', { from: minterAddress })
        // user owns 100 out of 1000 cokeLp tokens, so 10% of the 100 COKE owned by the LP, so now 20
        assert.equal((await this.cokeToken.balanceOf(this.cokeLp2.address)).toString(), '100')
        assert.equal((await this.policeChief.cokeBalanceStaked(minterAddress)).toString(), '20')

        // if another user deposits it makes no difference
        await this.cokeLp.transfer(user1Address, '100', { from: minterAddress });
        await this.cokeLp.approve(this.policeChief.address, '100', { from: user1Address })
        await this.policeChief.deposit('0', '100', { from: user1Address })
        assert.equal((await this.cokeToken.balanceOf(this.cokeLp2.address)).toString(), '100')
        assert.equal((await this.policeChief.cokeBalanceStaked(minterAddress)).toString(), '20')
        // new user who is now also staking 100 / 1000 owns 10% of the 100 COKE in the lp
        assert.equal((await this.policeChief.cokeBalanceStaked(user1Address)).toString(), '10')
    
        // check balance all
        let balance, pendingHarvest, staked
        pendingHarvest = await this.policeChief.cokeBalancePendingHarvest(minterAddress)
        staked = await this.policeChief.cokeBalanceStaked(minterAddress)
        assert.equal((await this.policeChief.cokeBalanceAll(minterAddress)).toString(), pendingHarvest.add(staked).toString())
        // balance + pending harvest + staked should equal balance all after harvest
        await this.policeChief.deposit('0', '0', { from: minterAddress })
        balance = await this.cokeToken.balanceOf(minterAddress)
        pendingHarvest = await this.policeChief.cokeBalancePendingHarvest(minterAddress)
        staked = await this.policeChief.cokeBalanceStaked(minterAddress)
        assert.equal((await this.policeChief.cokeBalanceAll(minterAddress)).toString(), pendingHarvest.add(staked).add(balance).toString())

        // should still be true after a few blocks
        await time.advanceBlock()
        await time.advanceBlock()
        await time.advanceBlock()

        await this.policeChief.deposit('0', '0', { from: minterAddress })
        balance = await this.cokeToken.balanceOf(minterAddress)
        pendingHarvest = await this.policeChief.cokeBalancePendingHarvest(minterAddress)
        staked = await this.policeChief.cokeBalanceStaked(minterAddress)
        assert.equal((await this.policeChief.cokeBalanceAll(minterAddress)).toString(), pendingHarvest.add(staked).add(balance).toString())
    })
});

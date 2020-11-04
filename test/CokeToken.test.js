const { expectRevert } = require('@openzeppelin/test-helpers');
const CokeToken = artifacts.require('CokeToken');

contract('CokeToken', ([_, cokeTokenOwnerAddress, user1Address, user2Address, user3Address]) => {
    beforeEach(async () => {
        this.cokeToken = await CokeToken.new({from: cokeTokenOwnerAddress})
        this.defaultBurnDivisor = 100 // 1% burn, changing this will break the tests
        await this.cokeToken.setBurnDivisor(this.defaultBurnDivisor, {from: cokeTokenOwnerAddress})
    })

    it('should set burn divisor', async () => {
        // default burn divisor has been set
        assert.equal((await this.cokeToken.burnDivisor()).toString(), this.defaultBurnDivisor)

        // non owner cannot set
        await expectRevert(
            this.cokeToken.setBurnDivisor('50', {from: user1Address}),
            'Ownable: caller is not the owner.',
        );

        // divisor smaller than minimum
        await expectRevert(
            this.cokeToken.setBurnDivisor('2', {from: cokeTokenOwnerAddress}),
            'COKE::setBurnDivisor: burnDivisor must be bigger than 3',
        );

        // set it properly
        await this.cokeToken.setBurnDivisor('40', {from: cokeTokenOwnerAddress})
        assert.equal((await this.cokeToken.burnDivisor()).toString(), '40')
    });

    it('should have correct name and symbol and decimal', async () => {
        const name = await this.cokeToken.name();
        const symbol = await this.cokeToken.symbol();
        const decimals = await this.cokeToken.decimals();
        assert.equal(name.toString(), 'CokeToken');
        assert.equal(symbol.toString(), 'COKE');
        assert.equal(decimals.toString(), '18');
    });

    it('should only allow owner to mint token', async () => {
        await this.cokeToken.mint(cokeTokenOwnerAddress, '100', { from: cokeTokenOwnerAddress });
        await this.cokeToken.mint(user1Address, '1000', { from: cokeTokenOwnerAddress });
        await expectRevert(
            this.cokeToken.mint(user2Address, '1000', { from: user1Address }),
            'Ownable: caller is not the owner',
        );
        const totalSupply = await this.cokeToken.totalSupply();
        const cokeTokenOwnerAddressBal = await this.cokeToken.balanceOf(cokeTokenOwnerAddress);
        const user1AddressBal = await this.cokeToken.balanceOf(user1Address);
        const user2AddressBal = await this.cokeToken.balanceOf(user2Address);
        assert.equal(totalSupply.toString(), '1100');
        assert.equal(cokeTokenOwnerAddressBal.toString(), '100');
        assert.equal(user1AddressBal.toString(), '1000');
        assert.equal(user2AddressBal.toString(), '0');
    });

    it('should supply token transfers properly', async () => {
        await this.cokeToken.mint(cokeTokenOwnerAddress, '10000', { from: cokeTokenOwnerAddress });
        await this.cokeToken.mint(user1Address, '10000', { from: cokeTokenOwnerAddress });
        await this.cokeToken.transfer(user2Address, '1000', { from: cokeTokenOwnerAddress });
        await this.cokeToken.transfer(user2Address, '10000', { from: user1Address });
        const totalSupply = await this.cokeToken.totalSupply();
        const totalSupplyBurned = await this.cokeToken.totalSupplyBurned();
        const cokeTokenOwnerAddressBal = await this.cokeToken.balanceOf(cokeTokenOwnerAddress);
        const user1AddressBal = await this.cokeToken.balanceOf(user1Address);
        const user2AddressBal = await this.cokeToken.balanceOf(user2Address);
        const totalBurned = 10 + 100
        assert.equal(totalSupply.toString(), 20000 - totalBurned);
        assert.equal(cokeTokenOwnerAddressBal.toString(), '9000');
        assert.equal(user1AddressBal.toString(), '0');
        assert.equal(user2AddressBal.toString(), 990 + 9900);
        assert.equal(totalSupplyBurned.toString(), totalBurned);
    });

    it('should handle micro transfers', async () => {
        // no burn, too small
        await this.cokeToken.mint(cokeTokenOwnerAddress, '1', { from: cokeTokenOwnerAddress });
        await this.cokeToken.transfer(user1Address, '1', { from: cokeTokenOwnerAddress });
        assert.equal((await this.cokeToken.balanceOf(user1Address)).toString(), '1');
        assert.equal((await this.cokeToken.balanceOf(cokeTokenOwnerAddress)).toString(), '0');
        assert.equal((await this.cokeToken.totalSupply()).toString(), '1');
        assert.equal((await this.cokeToken.totalSupplyBurned()).toString(), '0');

        // try delegating
        await this.cokeToken.delegate(user2Address, {from: user1Address});
        assert.equal((await this.cokeToken.getCurrentVotes(user2Address)).toString(), '1');

        // no burn, too small
        await this.cokeToken.mint(cokeTokenOwnerAddress, '10', { from: cokeTokenOwnerAddress });
        await this.cokeToken.transfer(user1Address, '10', { from: cokeTokenOwnerAddress });
        assert.equal((await this.cokeToken.balanceOf(user1Address)).toString(), '11');
        assert.equal((await this.cokeToken.balanceOf(cokeTokenOwnerAddress)).toString(), '0');
        assert.equal((await this.cokeToken.totalSupply()).toString(), '11');
        assert.equal((await this.cokeToken.totalSupplyBurned()).toString(), '0');

        // delegating had updated
        assert.equal((await this.cokeToken.getCurrentVotes(user2Address)).toString(), '11');

        await this.cokeToken.mint(cokeTokenOwnerAddress, '100', { from: cokeTokenOwnerAddress });
        await this.cokeToken.transfer(user1Address, '100', { from: cokeTokenOwnerAddress });
        assert.equal((await this.cokeToken.balanceOf(user1Address)).toString(), '110');
        assert.equal((await this.cokeToken.balanceOf(cokeTokenOwnerAddress)).toString(), '0');
        assert.equal((await this.cokeToken.totalSupply()).toString(), '110');
        assert.equal((await this.cokeToken.totalSupplyBurned()).toString(), '1');

        // delegating had updated
        assert.equal((await this.cokeToken.getCurrentVotes(user2Address)).toString(), '110');

        await this.cokeToken.mint(cokeTokenOwnerAddress, '1000', { from: cokeTokenOwnerAddress });
        await this.cokeToken.transfer(user1Address, '1000', { from: cokeTokenOwnerAddress });
        assert.equal((await this.cokeToken.balanceOf(user1Address)).toString(), '1100');
        assert.equal((await this.cokeToken.balanceOf(cokeTokenOwnerAddress)).toString(), '0');
        assert.equal((await this.cokeToken.totalSupply()).toString(), '1100');
        assert.equal((await this.cokeToken.totalSupplyBurned()).toString(), '11');

        // delegating had updated
        assert.equal((await this.cokeToken.getCurrentVotes(user2Address)).toString(), '1100');

        await this.cokeToken.mint(cokeTokenOwnerAddress, '10000', { from: cokeTokenOwnerAddress });
        await this.cokeToken.transfer(user1Address, '10000', { from: cokeTokenOwnerAddress });
        assert.equal((await this.cokeToken.balanceOf(user1Address)).toString(), '11000');
        assert.equal((await this.cokeToken.balanceOf(cokeTokenOwnerAddress)).toString(), '0');
        assert.equal((await this.cokeToken.totalSupply()).toString(), '11000');
        assert.equal((await this.cokeToken.totalSupplyBurned()).toString(), '111');

        // delegating had updated
        assert.equal((await this.cokeToken.getCurrentVotes(user2Address)).toString(), '11000');
    });

    it('should fail if you try to do bad transfers', async () => {
        await this.cokeToken.mint(cokeTokenOwnerAddress, '100', { from: cokeTokenOwnerAddress });
        await expectRevert(
            this.cokeToken.transfer(user2Address, '110', { from: cokeTokenOwnerAddress }),
            'ERC20: transfer amount exceeds balance',
        );
        await expectRevert(
            this.cokeToken.transfer(user2Address, '1', { from: user1Address }),
            'ERC20: transfer amount exceeds balance',
        );
    });

    // https://medium.com/bulldax-finance/sushiswap-delegation-double-spending-bug-5adcc7b3830f
    it('should fix delegate transfer bug', async () => {
        await this.cokeToken.mint(cokeTokenOwnerAddress, '1000000', { from: cokeTokenOwnerAddress });
        await this.cokeToken.delegate(user3Address, {from: cokeTokenOwnerAddress});
        await this.cokeToken.transfer(user1Address, '1000000', {from: cokeTokenOwnerAddress} );
        await this.cokeToken.delegate(user3Address, {from: user1Address});
        await this.cokeToken.transfer(user2Address, '990000', {from: user1Address} );
        await this.cokeToken.delegate(user3Address, {from: user2Address});
        await this.cokeToken.transfer(cokeTokenOwnerAddress, '980100', {from: user2Address} );
        assert.equal((await this.cokeToken.totalSupply()).toString(), '970299');
        assert.equal((await this.cokeToken.getCurrentVotes(user3Address)).toString(), '970299');
        assert.equal((await this.cokeToken.getCurrentVotes(cokeTokenOwnerAddress)).toString(), '0');
        assert.equal((await this.cokeToken.getCurrentVotes(user1Address)).toString(), '0');
        assert.equal((await this.cokeToken.getCurrentVotes(user2Address)).toString(), '0');
    });
  });

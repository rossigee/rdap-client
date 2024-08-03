import assert from "assert";
import { rdapClient } from "../src";
import { ERRORS } from "../src/constants";

describe("rdap tests", () => {
    it("should find google.com successfully", async () => {
        const response = await rdapClient("google.com");
        assert.ok(response);
        assert.strictEqual(response.ldhName.toLowerCase(), "google.com");
    });

    it("should find likker.com.br successfully", async () => {
        const respone = await rdapClient("https://likker.com.br");
        assert.ok(respone);
        assert.strictEqual(respone.ldhName.toLowerCase(), "likker.com.br");
    });

    it("should fail to lookup a top level domain that does not exist", async () => {
        try {
            await rdapClient("domain.invalidTopLevelDomain");
        } catch (error: any) {
            assert.strictEqual(error.message, ERRORS.UnknownTLD);
        }
    });

    it("should find 1.1.1.1 successfully", async () => {
        const response = await rdapClient("1.1.1.1");
        assert.ok(response);
        assert.strictEqual(response.name, "APNIC-LABS");
        assert.strictEqual(response.startAddress, "1.1.1.0");
    });

    it("should find 2001:4860:4860::8888 successfully", async () => {
        const response = await rdapClient("2001:4860:4860::8888");
        assert.ok(response);
        assert.strictEqual(response.name, "GOOGLE-IPV6");
        assert.strictEqual(response.startAddress, "2001:4860::");
    });

    it("should fail to lookup because there was no domain provided", async () => {
        try {
            await rdapClient("");
        } catch (error: any) {
            assert.strictEqual(error.message, ERRORS.NoDomainError);
        }
    });
});

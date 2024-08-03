import fs from "fs";
import { DomainExtension, TLDData, RdapRawResponse } from "./types";
import { ERRORS } from "./constants";
import { RdapData, RdapResponse } from "./libraries/RdapData";

const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const ipv6Regex = /(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))/gi;

let dns: Array<TLDData> = [];

const isFullyQualifiedDomainName = (domain: string): boolean => {
  const parts = domain.split(".");
  const topLevelDomain = parts[parts.length - 1];

  if (parts.length < 2) return false;

  if (
    !/^([a-z\u00A1-\u00A8\u00AA-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]{2,}|xn[a-z0-9-]{2,})$/i.test(
      topLevelDomain
    )
  )
    return false;

  if (/\s/.test(topLevelDomain)) {
    return false;
  }

  if (/^\d+$/.test(topLevelDomain)) {
    return false;
  }

  return parts.every((part) => {
    if (part.length > 63) {
      return false;
    }

    if (!/^[a-z_\u00a1-\uffff0-9-]+$/i.test(part)) {
      return false;
    }

    if (/[\uff01-\uff5e]/.test(part)) {
      return false;
    }

    if (/^-|-$/.test(part)) {
      return false;
    }

    if (/_/.test(part)) {
      return false;
    }

    return true;
  });
};

function getTopLevelDomain(domain: string): string | null {
  if (!isFullyQualifiedDomainName(domain)) {
    return null;
  }
  const parts = domain.split(".");
  return parts[parts.length - 1];
}

function findRDAPServer(domain: string): URL {
  if (!domain) {
    throw new Error(ERRORS.NoDomainError);
  }
  const tld = getTopLevelDomain(domain);
  if (!tld) {
    throw new Error(ERRORS.DomainParseError);
  }

  if (!dns.length) {
    const dnsFile = fs.readFileSync(`${__dirname}/rdap-servers.json`, "utf-8");
    dns = JSON.parse(dnsFile);
  }

  const foundTld: TLDData | undefined = dns.find((i) =>
    i[0].find((j: DomainExtension) => j === tld)
  );
  if (!foundTld) {
    throw new Error(ERRORS.UnknownTLD);
  }
  return getUrl(foundTld[1][0]);
}

function getUrl(domain: string): URL {
  const indexOfDoubleSlash = domain.indexOf("//");

  if (indexOfDoubleSlash > -1) {
    return new URL(domain);
  }

  return new URL(`https://${domain}`);
}

function buildRdapRequestUrl(domainToQuery: string): string {
  const query = getUrl(domainToQuery);
  const server = findRDAPServer(query.hostname);
  let serverUrl = `${server.origin}${server.pathname}`;

  if (serverUrl.endsWith("/")) {
    serverUrl = serverUrl.substring(0, serverUrl.length - 1);
  }

  return `${serverUrl}/domain/${query.hostname}`;
}

async function rdapClient(query: string): Promise<RdapRawResponse> {
  if (query.trim() === "") {
    throw new Error(ERRORS.NoDomainError);
  }

  var requestUrl = "";
  if (ipv4Regex.test(query) || ipv6Regex.test(query)) {
    requestUrl = "https://rdap.org/ip/" + query;
  } else {
    requestUrl = buildRdapRequestUrl(query);
  }

  try {
    const response = await fetch(requestUrl);
    if (!response.ok) {
      throw new Error(ERRORS.RDAPError);
    }

    const responseData = await response.text();
    if (responseData === "" || responseData === "''") {
      throw new Error(ERRORS.RDAPResponseEmpty);
    }

    // console.log(JSON.parse(responseData))
    return JSON.parse(responseData);
  } catch (err) {
    throw new Error(ERRORS.RDAPError);
  }
}

export { rdapClient, RdapData, RdapRawResponse, RdapResponse };

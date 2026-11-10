/**
 * Form validators for supplier details: self-registration, adding and importing
 * suppliers, and the supplier profile (company, contacts, address, banking),
 * whether edited by the supplier or by procurement.
 *
 * Built from the helpers in rules.ts; see that file for the conventions.
 *
 * One validator, validateCompanyDetails, checks every supplier field. The four
 * ways in read their own payload shape into it and say which fields apply:
 *
 *   validateSupplierRegistration  the supplier's own registration (POST /auth/register)
 *   validateNewSupplier           Add Supplier (POST /procurement/suppliers)
 *   validateSupplierImportRow     one row of a bulk import (POST /procurement/suppliers/bulk-import)
 *   validateSupplierProfileUpdate an edit by procurement (PUT /procurement/suppliers/:id)
 *                                 or by the supplier (PUT /supplier/profile)
 */
import { mapLegacyCategory } from '../constants/legacyCategoryMap.js';
import { BANKS, PROVINCES } from '../constants/regions.js';
import { isValidCategoryCode } from '../constants/supplierCategories.js';
import {
  FormErrors,
  TEXT_LIMITS,
  date,
  email,
  isBlank,
  lineField,
  maxLength,
  notFuture,
  oneOf,
  password,
  phone,
  required,
  sameAs,
  text,
  url,
  type FieldErrors
} from './rules.js';

// Kept in step with SUPPLIER_BUSINESS_TYPES and SUPPLIER_ENTITY_TYPES in
// api/src/models/SupplierProfile.model.ts. Not exported: the client lists them
// with labels in client/src/lib/supplierTypes.ts.
const BUSINESS_TYPE_VALUES: readonly string[] = [
  'manufacturer',
  'distributor',
  'wholesaler',
  'retailer',
  'service_provider',
  'contractor',
  'other'
];
const ENTITY_TYPE_VALUES: readonly string[] = ['company', 'individual'];

/**
 * Account types the supplier record and a banking change accept. The screens
 * offer current and savings (and nostro, which the record does not accept).
 */
const ACCOUNT_TYPE_VALUES: readonly string[] = ['current', 'savings', 'cheque'];

/** Longest value accepted for supplier fields that TEXT_LIMITS does not cover. */
const LIMITS = {
  /** Registration, tax and VAT numbers. */
  reference: 50,
  place: 80,
  postalCode: 20,
  bankName: 120,
  branchCode: 40,
  product: 120
} as const;

/** Matches the server's reading: case, spaces and hyphens are ignored ("Service Provider"). */
function classification(value: unknown, allowed: readonly string[], message: string): string {
  if (isBlank(value)) return '';
  const normalised = text(value).toLowerCase().replace(/[\s-]+/g, '_');
  return allowed.includes(normalised) ? '' : message;
}

/**
 * A bank account number. In Zimbabwe, digits (spaces and dashes are fine), 6 to
 * 20 of them. Abroad, letters are allowed too, for an IBAN.
 */
function bankAccountNumber(value: unknown, abroad: boolean): string {
  if (isBlank(value)) return '';
  const v = text(value);
  if (abroad) {
    const compact = v.replace(/[\s-]/g, '');
    return /^[A-Za-z0-9]{5,34}$/.test(compact)
      ? ''
      : 'Enter the account number in letters and digits (5 to 34)';
  }
  if (!/^[\d\s-]+$/.test(v)) return 'Enter the account number in digits only';
  const digits = v.replace(/\D/g, '').length;
  return digits >= 6 && digits <= 20 ? '' : 'Account number must be 6 to 20 digits';
}

/** Category codes as a list, from a list or a comma-separated cell. */
function categoryValues(value: unknown): string[] | null {
  if (isBlank(value)) return [];
  if (Array.isArray(value)) return value.map((c) => text(c)).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((c) => c.trim()).filter(Boolean);
  return null;
}

/**
 * Categories from the list. With `legacy`, older free-text names the server
 * translates (a bulk import) are accepted too, in one comma-separated cell.
 * Otherwise they must come as a list, as the screens send them.
 */
function categories(value: unknown, legacy: boolean): string {
  if (!legacy && !isBlank(value) && !Array.isArray(value)) return 'Choose categories from the list';
  const values = categoryValues(value);
  if (values === null) return 'Choose categories from the list';
  const unknown = values.filter((c) => !isValidCategoryCode(c) && !(legacy && mapLegacyCategory(c).length > 0));
  if (unknown.length === 0) return '';
  return legacy
    ? `Use category codes; not recognised: ${unknown.join(', ')}`
    : `Choose categories from the list; not recognised: ${unknown.join(', ')}`;
}

export interface ContactPersonInput {
  name?: unknown;
  position?: unknown;
  email?: unknown;
  phone?: unknown;
  isPrimary?: unknown;
}

export interface ClientReferralInput {
  clientName?: unknown;
  /** Older spelling the server still reads. */
  name?: unknown;
  contactPerson?: unknown;
  contactEmail?: unknown;
  email?: unknown;
  contactPhone?: unknown;
  phone?: unknown;
  projectDescription?: unknown;
}

/** Every supplier field, flat. Each way in reads its own payload into this shape. */
export interface CompanyDetailsInput {
  // The login and its person
  email?: unknown;
  password?: unknown;
  /** Only on the screen; the server never receives it. */
  confirmPassword?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  phone?: unknown;
  /** The contact's whole name, as an import row holds it. */
  contactPerson?: unknown;
  // Company
  companyName?: unknown;
  tradingName?: unknown;
  registrationNumber?: unknown;
  taxNumber?: unknown;
  vatNumber?: unknown;
  businessType?: unknown;
  entityType?: unknown;
  categories?: unknown;
  website?: unknown;
  incorporationDate?: unknown;
  notes?: unknown;
  proposedBusiness?: unknown;
  tradeVolume?: unknown;
  tradeProducts?: unknown;
  // Address
  street?: unknown;
  city?: unknown;
  province?: unknown;
  postalCode?: unknown;
  country?: unknown;
  /** Only on the screen: the name typed when the country chosen is "Other". */
  countryOther?: unknown;
  // Banking
  bankName?: unknown;
  accountName?: unknown;
  accountNumber?: unknown;
  branchCode?: unknown;
  accountType?: unknown;
  // Lists
  contactPersons?: unknown;
  clientReferrals?: unknown;
}

export type CompanyDetailsField = keyof CompanyDetailsInput;

export interface CompanyDetailsOptions {
  /** An edit: only the fields sent are checked, so a required one is refused only when sent empty. */
  partial?: boolean;
  /**
   * Which login fields the form carries, and which of them it requires:
   * - `register`: email, password, first and last name, and phone
   * - `create`: email, first and last name; the password is optional (one is generated)
   * - `import`: the contact's name, email and phone
   * - `edit`: the supplier's login on the profile; email and names may not be emptied
   */
  login?: 'register' | 'create' | 'import' | 'edit';
  /** The country chosen is Zimbabwe: the province and the bank come from the lists. */
  zimbabweLists?: boolean;
  /** The supplier's country when the input carries none (a banking-only edit). Defaults to Zimbabwe. */
  country?: unknown;
  /** The form requires a country (registration). */
  requireCountry?: boolean;
  /** Categories may be older free-text names that the server translates (bulk import). */
  legacyCategories?: boolean;
  /** Error keys for fields a form names differently, e.g. `{ street: 'physicalAddress' }`. */
  names?: Partial<Record<CompanyDetailsField, string>>;
}

/** Supplier company details: one check for every way a supplier is registered or edited. */
export function validateCompanyDetails(input: CompanyDetailsInput, options: CompanyDetailsOptions = {}): FieldErrors {
  const { partial = false, login, names = {} } = options;
  const v = new FormErrors();
  const key = (field: CompanyDetailsField) => names[field] || field;
  const add = (field: CompanyDetailsField, ...results: string[]) => v.add(key(field), ...results);
  /** A required field is checked when the form always has it, or when an edit sends it. */
  const sent = (field: CompanyDetailsField) => !partial || input[field] !== undefined;
  const needs = (field: CompanyDetailsField, message: string) => (sent(field) ? required(input[field], message) : '');
  const yours = login === 'register';

  // The login and its person
  if (login) {
    const emailRequired = login === 'edit' ? 'Enter the sign-in email' : yours ? 'Enter your email address' : "Enter the supplier's email";
    add('email', needs('email', emailRequired), email(input.email));
    if (yours) add('password', needs('password', 'Enter a password'), password(input.password));
    else add('password', password(input.password));
    if (input.confirmPassword !== undefined) {
      v.add(
        'confirmPassword',
        required(input.confirmPassword, 'Confirm your password'),
        sameAs(input.confirmPassword, input.password, 'Passwords do not match')
      );
    }
    if (login === 'import') {
      add(
        'contactPerson',
        needs('contactPerson', "Enter the contact person's name"),
        maxLength(input.contactPerson, TEXT_LIMITS.name, 'Contact person')
      );
    } else {
      add(
        'firstName',
        needs('firstName', yours ? 'Enter your first name' : "Enter the contact's first name"),
        maxLength(input.firstName, TEXT_LIMITS.name, 'First name')
      );
      add(
        'lastName',
        needs('lastName', yours ? 'Enter your last name' : "Enter the contact's last name"),
        maxLength(input.lastName, TEXT_LIMITS.name, 'Last name')
      );
    }
    const phoneRequired = yours ? 'Enter your phone number' : login === 'import' ? "Enter the contact's phone number" : '';
    add(
      'phone',
      phoneRequired ? needs('phone', phoneRequired) : '',
      phone(input.phone),
      maxLength(input.phone, TEXT_LIMITS.phone, 'Phone number')
    );
  }

  // Company
  add('companyName', needs('companyName', 'Enter the company name'), maxLength(input.companyName, TEXT_LIMITS.short, 'Company name'));
  add('tradingName', maxLength(input.tradingName, TEXT_LIMITS.short, 'Trading name'));
  add(
    'registrationNumber',
    needs('registrationNumber', 'Enter the registration number'),
    maxLength(input.registrationNumber, LIMITS.reference, 'Registration number')
  );
  add('taxNumber', maxLength(input.taxNumber, LIMITS.reference, 'Tax number'));
  add('vatNumber', maxLength(input.vatNumber, LIMITS.reference, 'VAT number'));
  add('businessType', classification(input.businessType, BUSINESS_TYPE_VALUES, 'Choose a business type from the list'));
  add('entityType', classification(input.entityType, ENTITY_TYPE_VALUES, 'Choose company or individual'));
  if (input.categories !== undefined) add('categories', categories(input.categories, !!options.legacyCategories));
  add('website', url(input.website), maxLength(input.website, TEXT_LIMITS.short, 'Website'));
  add('incorporationDate', date(input.incorporationDate, 'Incorporation date'), notFuture(input.incorporationDate, 'Incorporation date'));
  add('notes', maxLength(input.notes, TEXT_LIMITS.long, 'Description'));
  add('proposedBusiness', maxLength(input.proposedBusiness, TEXT_LIMITS.short, 'Proposed business'));
  add('tradeVolume', maxLength(input.tradeVolume, TEXT_LIMITS.short, 'Volume'));
  if (input.tradeProducts !== undefined) {
    const products = categoryValues(input.tradeProducts);
    add(
      'tradeProducts',
      products === null ? 'List the products, separated by commas' : '',
      (products || []).some((p) => p.length > LIMITS.product)
        ? `Keep each product to ${LIMITS.product} characters or fewer`
        : ''
    );
  }

  // Address
  const country = text(input.country);
  const zimbabwe = !!options.zimbabweLists && country === 'Zimbabwe';
  add('street', maxLength(input.street, TEXT_LIMITS.short, 'Street address'));
  add('city', maxLength(input.city, LIMITS.place, 'City'));
  add(
    'province',
    zimbabwe ? oneOf(text(input.province), PROVINCES, 'Choose a province from the list') : '',
    maxLength(input.province, LIMITS.place, 'Province')
  );
  add('postalCode', maxLength(input.postalCode, LIMITS.postalCode, 'Postal code'));
  add(
    'country',
    options.requireCountry ? required(input.country, 'Choose your country') : '',
    maxLength(input.country, LIMITS.place, 'Country')
  );
  if (country === 'Other' && input.countryOther !== undefined) {
    add('countryOther', required(input.countryOther, 'Enter your country name'), maxLength(input.countryOther, LIMITS.place, 'Country name'));
  }

  // Banking
  const homeCountry = country || text(options.country) || 'Zimbabwe';
  const abroad = homeCountry.toLowerCase() !== 'zimbabwe';
  add(
    'bankName',
    zimbabwe ? oneOf(text(input.bankName), BANKS, 'Choose a bank from the list') : '',
    maxLength(input.bankName, LIMITS.bankName, 'Bank name')
  );
  add('accountName', maxLength(input.accountName, TEXT_LIMITS.short, 'Account name'));
  add('accountNumber', bankAccountNumber(input.accountNumber, abroad));
  add('branchCode', maxLength(input.branchCode, LIMITS.branchCode, 'Branch code'));
  add('accountType', oneOf(text(input.accountType), ACCOUNT_TYPE_VALUES, 'Choose a current or savings account'));

  // Directors and contacts: the record requires a name, email and phone for each.
  if (input.contactPersons !== undefined) {
    if (!Array.isArray(input.contactPersons)) {
      v.add('contactPersons', 'Add the contacts as a list');
    } else {
      input.contactPersons.forEach((raw: unknown, i: number) => {
        const person = (raw && typeof raw === 'object' ? raw : {}) as ContactPersonInput;
        v.add(lineField('contactPersons', i, 'name'), required(person.name, "Enter the contact's name"), maxLength(person.name, TEXT_LIMITS.name, 'Name'));
        v.add(lineField('contactPersons', i, 'position'), maxLength(person.position, TEXT_LIMITS.name, 'Position'));
        v.add(lineField('contactPersons', i, 'email'), required(person.email, "Enter the contact's email"), email(person.email));
        v.add(
          lineField('contactPersons', i, 'phone'),
          required(person.phone, "Enter the contact's phone number"),
          phone(person.phone),
          maxLength(person.phone, TEXT_LIMITS.phone, 'Phone number')
        );
      });
    }
  }

  // Trade references: the record requires the client's name.
  if (input.clientReferrals !== undefined) {
    if (!Array.isArray(input.clientReferrals)) {
      v.add('clientReferrals', 'Add the references as a list');
    } else {
      input.clientReferrals.forEach((raw: unknown, i: number) => {
        const ref = (raw && typeof raw === 'object' ? raw : {}) as ClientReferralInput;
        const clientName = isBlank(ref.clientName) ? ref.name : ref.clientName;
        const contactEmail = isBlank(ref.contactEmail) ? ref.email : ref.contactEmail;
        const contactPhone = isBlank(ref.contactPhone) ? ref.phone : ref.contactPhone;
        v.add(lineField('clientReferrals', i, 'clientName'), required(clientName, "Enter the client's name"), maxLength(clientName, TEXT_LIMITS.short, 'Client name'));
        v.add(lineField('clientReferrals', i, 'contactPerson'), maxLength(ref.contactPerson, TEXT_LIMITS.name, 'Contact person'));
        v.add(lineField('clientReferrals', i, 'contactEmail'), email(contactEmail));
        v.add(lineField('clientReferrals', i, 'contactPhone'), phone(contactPhone), maxLength(contactPhone, TEXT_LIMITS.phone, 'Phone number'));
        v.add(lineField('clientReferrals', i, 'projectDescription'), maxLength(ref.projectDescription, TEXT_LIMITS.long, 'Project description'));
      });
    }
  }

  return v.errors;
}

type Loose = Record<string, any> | null | undefined;

const obj = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};

/** The first value that is not blank, else the first one given. */
const either = (a: unknown, b: unknown): unknown => (isBlank(a) ? (b === undefined ? a : b) : a);

export interface SupplierRegistrationInput {
  email?: unknown;
  password?: unknown;
  /** Only on the screen. */
  confirmPassword?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  phone?: unknown;
  /** The company, as the screen sends it. */
  companyDetails?: Loose;
  /** The same, under the older name the API also reads. */
  supplierProfile?: Loose;
  /** Only on the screen: the country name typed when "Other" is chosen. */
  countryOther?: unknown;
}

/**
 * A supplier registering itself, in five steps. The screen also requires a
 * country (`requireCountry`); the API never has, and an address without one is
 * recorded as Zimbabwe.
 */
export function validateSupplierRegistration(
  input: SupplierRegistrationInput,
  { requireCountry = false }: { requireCountry?: boolean } = {}
): FieldErrors {
  const company = obj(input.companyDetails || input.supplierProfile);
  const address = obj(company.address);
  const bank = obj(company.bankDetails);
  return validateCompanyDetails(
    {
      email: input.email,
      password: input.password,
      confirmPassword: input.confirmPassword,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      companyName: company.companyName,
      tradingName: company.tradingName,
      registrationNumber: company.registrationNumber,
      taxNumber: company.taxNumber,
      vatNumber: company.vatNumber,
      businessType: company.businessType,
      entityType: company.entityType,
      categories: company.categories,
      street: either(address.street, address.physical),
      city: address.city,
      province: address.province,
      postalCode: address.postalCode,
      country: address.country,
      countryOther: input.countryOther,
      bankName: bank.bankName,
      accountName: bank.accountName,
      accountNumber: bank.accountNumber,
      branchCode: bank.branchCode,
      accountType: bank.accountType
    },
    { login: 'register', zimbabweLists: true, requireCountry }
  );
}

/** Add Supplier and import rows name some fields their own way. */
const FLAT_NAMES: Partial<Record<CompanyDetailsField, string>> = {
  tradingName: 'tradingAs',
  street: 'physicalAddress',
  accountName: 'bankAccountName',
  accountNumber: 'bankAccountNumber',
  branchCode: 'bankBranchCode'
};

function flatCompany(input: Record<string, any>): CompanyDetailsInput {
  return {
    email: input.email,
    phone: input.phone,
    companyName: input.companyName,
    tradingName: either(input.tradingName, input.tradingAs),
    registrationNumber: input.registrationNumber,
    taxNumber: input.taxNumber,
    vatNumber: input.vatNumber,
    businessType: input.businessType,
    entityType: input.entityType,
    categories: input.categories,
    street: input.physicalAddress,
    city: input.city,
    province: input.province,
    postalCode: input.postalCode,
    bankName: input.bankName,
    accountName: input.bankAccountName,
    accountNumber: input.bankAccountNumber,
    branchCode: input.bankBranchCode
  };
}

/** Procurement adds a supplier. Error keys are the form's own (`physicalAddress`, `bankAccountNumber`). */
export function validateNewSupplier(input: Loose): FieldErrors {
  const body = obj(input);
  return validateCompanyDetails(
    { ...flatCompany(body), password: body.password, firstName: body.firstName, lastName: body.lastName },
    { login: 'create', names: FLAT_NAMES }
  );
}

/**
 * One row of a bulk import. Categories may be codes or older free-text names
 * the server translates, as a list or one comma-separated cell.
 */
export function validateSupplierImportRow(row: Loose): FieldErrors {
  const body = obj(row);
  return validateCompanyDetails(
    { ...flatCompany(body), contactPerson: body.contactPerson },
    { login: 'import', legacyCategories: true, names: FLAT_NAMES }
  );
}

/** Error keys for a profile edit: the payload's own paths. */
const PROFILE_NAMES: Partial<Record<CompanyDetailsField, string>> = {
  email: 'user.email',
  phone: 'user.phone',
  firstName: 'user.firstName',
  lastName: 'user.lastName',
  street: 'address.street',
  city: 'address.city',
  province: 'address.province',
  postalCode: 'address.postalCode',
  country: 'address.country',
  bankName: 'bankDetails.bankName',
  accountName: 'bankDetails.accountName',
  accountNumber: 'bankDetails.accountNumber',
  branchCode: 'bankDetails.branchCode',
  accountType: 'bankDetails.accountType'
};

/**
 * An edit to a supplier's profile, by procurement (a section at a time) or by
 * the supplier. Only the fields sent are checked. `country` is the supplier's
 * country on record, for a banking edit that does not send the address.
 */
export function validateSupplierProfileUpdate(input: Loose, { country }: { country?: unknown } = {}): FieldErrors {
  const body = obj(input);
  const has = (field: string) => body[field] !== undefined && body[field] !== null;
  const address = has('address') ? obj(body.address) : null;
  const bank = has('bankDetails') ? obj(body.bankDetails) : null;
  const user = has('user') ? obj(body.user) : null;
  return validateCompanyDetails(
    {
      email: user?.email,
      phone: user?.phone,
      firstName: user?.firstName,
      lastName: user?.lastName,
      companyName: body.companyName,
      tradingName: body.tradingName === undefined ? body.tradingAs : body.tradingName,
      registrationNumber: body.registrationNumber,
      taxNumber: body.taxNumber,
      vatNumber: body.vatNumber,
      businessType: body.businessType,
      entityType: body.entityType,
      categories: body.categories,
      website: body.website,
      incorporationDate: body.incorporationDate,
      notes: body.notes,
      proposedBusiness: body.proposedBusiness,
      tradeVolume: body.tradeVolume,
      tradeProducts: body.tradeProducts,
      street: address ? either(address.street, address.physical) : undefined,
      city: address?.city,
      province: address?.province,
      postalCode: address?.postalCode,
      country: address?.country,
      bankName: bank?.bankName,
      accountName: bank?.accountName,
      accountNumber: bank?.accountNumber,
      branchCode: bank?.branchCode,
      accountType: bank?.accountType,
      contactPersons: body.contactPersons,
      clientReferrals: body.clientReferrals
    },
    { partial: true, login: user ? 'edit' : undefined, country, names: PROFILE_NAMES }
  );
}
